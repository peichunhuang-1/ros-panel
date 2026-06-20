import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { readMsgSchema, readSrvSchema, readActionSchema, generateAllSchemas } from '../server/schema_gen.js';

// ── helpers ──────────────────────────────────────────────────────────

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ros-panel-test-'));
}

function writeJson(dir, filename, obj) {
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(obj, null, 2));
}

function readJson(dir, filename) {
  return JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf-8'));
}

// ── readMsgSchema ────────────────────────────────────────────────────

describe('readMsgSchema', () => {
  let dir;

  before(() => {
    dir = tmpDir();
    writeJson(dir, 'std_msgs__String.json', {
      properties: { data: { type: 'string', title: 'data' } },
    });
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('returns cached schema from schemaDir', async () => {
    const schema = await readMsgSchema('std_msgs', 'String', dir);
    assert.deepEqual(schema.properties.data, { type: 'string', title: 'data' });
  });

  test('throws when schema file is missing', async () => {
    await assert.rejects(
      () => readMsgSchema('unknown_pkg', 'Missing', dir),
      /Schema not found/,
    );
  });
});

// ── readSrvSchema ────────────────────────────────────────────────────

describe('readSrvSchema (cached)', () => {
  let dir;

  before(() => {
    dir = tmpDir();
    writeJson(dir, 'std_srvs__SetBool.json', {
      request:  { data: { type: 'boolean', title: 'data' } },
      response: {
        success: { type: 'boolean', title: 'success' },
        message: { type: 'string',  title: 'message' },
      },
    });
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('returns { type: object, properties: request } from cache', async () => {
    const schema = await readSrvSchema('std_srvs', 'SetBool', dir);
    assert.equal(schema.type, 'object');
    assert.deepEqual(schema.properties.data, { type: 'boolean', title: 'data' });
  });

  test('throws when not cached and AMENT_PREFIX_PATH is empty', async () => {
    const saved = process.env.AMENT_PREFIX_PATH;
    process.env.AMENT_PREFIX_PATH = '';
    try {
      await assert.rejects(
        () => readSrvSchema('std_srvs', 'Missing', null),
        /Service file not found/,
      );
    } finally {
      process.env.AMENT_PREFIX_PATH = saved;
    }
  });
});

// ── readActionSchema ─────────────────────────────────────────────────

describe('readActionSchema (cached)', () => {
  let dir;

  before(() => {
    dir = tmpDir();
    writeJson(dir, 'nav2_msgs__NavigateToPose.json', {
      goal:     { pose: { type: 'object', title: 'pose', properties: {} } },
      result:   { error_code: { type: 'integer', title: 'error_code' } },
      feedback: { distance_remaining: { type: 'number', title: 'distance_remaining' } },
    });
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('returns { goal, result, feedback } from cache', async () => {
    const schema = await readActionSchema('nav2_msgs', 'NavigateToPose', dir);
    assert.ok(schema.goal,     'missing goal');
    assert.ok(schema.result,   'missing result');
    assert.ok(schema.feedback, 'missing feedback');
  });

  test('feedback field has correct type', async () => {
    const schema = await readActionSchema('nav2_msgs', 'NavigateToPose', dir);
    assert.equal(schema.feedback.distance_remaining.type, 'number');
  });

  test('throws when not cached and AMENT_PREFIX_PATH is empty', async () => {
    const saved = process.env.AMENT_PREFIX_PATH;
    process.env.AMENT_PREFIX_PATH = '';
    try {
      await assert.rejects(
        () => readActionSchema('nav2_msgs', 'Missing', null),
        /Action file not found/,
      );
    } finally {
      process.env.AMENT_PREFIX_PATH = saved;
    }
  });
});

// ── generateAllSchemas (real ROS2 environment) ────────────────────────
//
// Requires AMENT_PREFIX_PATH to be set (i.e. source /opt/ros/humble/setup.bash).
// Output goes to SCHEMA_GEN_OUTPUT when set (mounted host directory),
// otherwise a temp dir that is cleaned up after the suite.

const amentSet = !!process.env.AMENT_PREFIX_PATH;
const parserAvailable = amentSet && await (async () => {
  try { await import('rclnodejs/rosidl_parser/rosidl_parser.js'); return true; }
  catch { return false; }
})();

const persistDir = process.env.SCHEMA_GEN_OUTPUT ?? null;

describe('generateAllSchemas', {
  skip: !parserAvailable && 'AMENT_PREFIX_PATH not set or rclnodejs not installed',
}, () => {
  const outputDir = persistDir ?? tmpDir();

  before(async () => {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`\n[schema-gen test] Writing schemas to: ${outputDir}`);
    await generateAllSchemas(outputDir);
    console.log(`[schema-gen test] Done — inspect ${outputDir} to review all output.\n`);
  });

  after(() => {
    if (!persistDir) fs.rmSync(outputDir, { recursive: true, force: true });
  });

  // ── std_msgs ──────────────────────────────────────────────────────

  test('std_msgs/String: data is string', () => {
    const { properties } = readJson(outputDir, 'std_msgs__String.json');
    assert.equal(properties.data.type, 'string');
    assert.equal(properties.data.title, 'data');
  });

  test('std_msgs/Header: has stamp (object) and frame_id (string)', () => {
    const { properties } = readJson(outputDir, 'std_msgs__Header.json');
    assert.equal(properties.stamp.type, 'object');
    assert.equal(properties.frame_id.type, 'string');
  });

  // ── geometry_msgs ─────────────────────────────────────────────────

  test('geometry_msgs/Point: x/y/z are number', () => {
    const { properties } = readJson(outputDir, 'geometry_msgs__Point.json');
    assert.equal(properties.x.type, 'number');
    assert.equal(properties.y.type, 'number');
    assert.equal(properties.z.type, 'number');
  });

  test('geometry_msgs/Pose: has nested position and orientation objects', () => {
    const { properties } = readJson(outputDir, 'geometry_msgs__Pose.json');
    assert.equal(properties.position.type, 'object');
    assert.equal(properties.orientation.type, 'object');
  });

  // ── std_srvs ──────────────────────────────────────────────────────

  test('std_srvs/SetBool: request.data boolean, response.success boolean', () => {
    const schema = readJson(outputDir, 'std_srvs__SetBool.json');
    assert.equal(schema.request.data.type, 'boolean');
    assert.equal(schema.response.success.type, 'boolean');
    assert.equal(schema.response.message.type, 'string');
  });

  test('std_srvs/Trigger: empty request, response has success + message', () => {
    const schema = readJson(outputDir, 'std_srvs__Trigger.json');
    assert.equal(Object.keys(schema.request).length, 0);
    assert.equal(schema.response.success.type, 'boolean');
  });

  // ── example_interfaces action ─────────────────────────────────────

  test('example_interfaces/Fibonacci: goal.order is integer', () => {
    const schema = readJson(outputDir, 'example_interfaces__Fibonacci.json');
    assert.equal(schema.goal.order.type, 'integer');
  });

  test('example_interfaces/Fibonacci: result.sequence is array of integers', () => {
    const schema = readJson(outputDir, 'example_interfaces__Fibonacci.json');
    assert.equal(schema.result.sequence.type, 'array');
    assert.equal(schema.result.sequence.items.type, 'integer');
  });

  test('example_interfaces/Fibonacci: feedback.sequence is array', () => {
    const schema = readJson(outputDir, 'example_interfaces__Fibonacci.json');
    assert.equal(schema.feedback.sequence.type, 'array');
  });
});
