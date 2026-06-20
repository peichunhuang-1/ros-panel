import rclnodejs from 'rclnodejs';
import express from 'express';
import cors from 'cors';
import { readMsgSchema, readSrvSchema } from './schema_gen.js';

const managed = {};
let node = null;

function stripLeadingSlash(name) {
  return name.startsWith('/') ? name.slice(1) : name;
}

function extractPkgAndMsg(rosType) {
  const parts = rosType.split('/');
  return { pkg: parts[0], msg: parts[2] };
}

function findInGraph(entries, name) {
  const match = entries.find(({ name: n }) => n === name || n === `/${name}`);
  if (!match) throw new Error(`Not found in ROS graph: ${name}`);
  return match;
}

async function addTopicPublisher(topicName, schemaDir) {
  const key = `topic#${topicName}`;
  if (managed[key]) return managed[key].schema;

  const match = findInGraph(node.getTopicNamesAndTypes(), topicName);
  const { pkg, msg } = extractPkgAndMsg(match.types[0]);
  const MessageType = rclnodejs.require(match.types[0]);
  const publisher = node.createPublisher(MessageType, topicName);
  const schema = await readMsgSchema(pkg, msg, schemaDir);

  managed[key] = {
    schema,
    call: (message) => { publisher.publish(message); return {}; },
  };
  return schema;
}

async function addServiceClient(serviceName, schemaDir) {
  const key = `service#${serviceName}`;
  if (managed[key]) return managed[key].schema;

  const match = findInGraph(node.getServiceNamesAndTypes(), serviceName);
  const { pkg, msg } = extractPkgAndMsg(match.types[0]);
  const client = node.createClient(match.types[0], serviceName);
  const ready = await client.waitForService(1000);
  if (!ready) throw new Error(`Service not ready: ${serviceName}`);

  const schema = await readSrvSchema(pkg, msg, schemaDir);

  managed[key] = {
    schema,
    call: (request) => client.sendRequestAsync(request, { timeout: 5000 }),
  };
  return schema;
}

function removeEntry(type, name) {
  delete managed[`${type}#${name}`];
}

export async function startServer({ port = 3000, schemaDir, corsOrigins = ['http://localhost:5173', 'http://localhost:3001'] } = {}) {
  await rclnodejs.init();
  node = rclnodejs.createNode('ros_panel_node');

  const app = express();
  app.use(express.json());
  app.use(cors({ origin: corsOrigins, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));

  // Serialize BigInt values in responses
  app.use((_, res, next) => {
    const orig = res.json.bind(res);
    res.json = (body) => orig(JSON.parse(JSON.stringify(body, (__, v) => (typeof v === 'bigint' ? v.toString() : v))));
    next();
  });

  app.get('/', (_, res) => res.json({ status: 'ok', endpoints: ['/nodes', '/topics', '/services'] }));
  app.get('/nodes',    (_, res) => res.json(node.getNodeNames()));
  app.get('/topics',   (_, res) => res.json(node.getTopicNamesAndTypes()));
  app.get('/services', (_, res) => res.json(node.getServiceNamesAndTypes()));

  app.post('/add/topic', async (req, res) => {
    try {
      res.json(await addTopicPublisher(stripLeadingSlash(req.body.name), schemaDir));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/add/service', async (req, res) => {
    try {
      res.json(await addServiceClient(stripLeadingSlash(req.body.name), schemaDir));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/call_api', async (req, res) => {
    const { type, name, form } = req.body;
    const entry = managed[`${type}#${stripLeadingSlash(name)}`];
    if (!entry) return res.status(404).json({ error: 'Not registered' });
    try {
      res.json(await entry.call(form));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/delete/topic',   (req, res) => { removeEntry('topic',   stripLeadingSlash(req.body.name)); res.json({ status: 'removed' }); });
  app.post('/delete/service', (req, res) => { removeEntry('service', stripLeadingSlash(req.body.name)); res.json({ status: 'removed' }); });

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[ros-panel] Server running on port ${port}`);
  });

  setInterval(() => rclnodejs.spinOnce(node), 10);

  process.on('SIGINT', async () => {
    server.close();
    await rclnodejs.shutdown();
    process.exit(0);
  });
}
