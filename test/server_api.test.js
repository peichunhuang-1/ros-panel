import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3000';

// ── helpers ──────────────────────────────────────────────────────────

async function get(path) {
  const res = await fetch(`${SERVER}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

/** Retry fn until it resolves or deadline passes. */
async function retry(fn, { maxMs = 10_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + maxMs;
  let lastErr;
  while (Date.now() < deadline) {
    try { return await fn(); } catch (e) { lastErr = e; }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw lastErr;
}

/** Parse an SSE response body into [{event, data}] array. */
async function readSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const blocks = buf.split('\n\n');
    buf = blocks.pop();               // last block may be incomplete

    for (const block of blocks) {
      let event = 'message';
      let data  = null;
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        if (line.startsWith('data: '))  data  = JSON.parse(line.slice(6));
      }
      if (data !== null) events.push({ event, data });
    }
  }

  return events;
}

// ── server health ─────────────────────────────────────────────────────

describe('server health', () => {
  before(() =>
    retry(() => get('/'), { maxMs: 30_000 }),
  );

  test('GET / returns status ok', async () => {
    const body = await get('/');
    assert.equal(body.status, 'ok');
  });

  test('GET /topics returns an array', async () => {
    assert.ok(Array.isArray(await get('/topics')));
  });

  test('GET /services returns an array', async () => {
    assert.ok(Array.isArray(await get('/services')));
  });

  test('GET /actions returns an array', async () => {
    assert.ok(Array.isArray(await get('/actions')));
  });
});

// ── topic ─────────────────────────────────────────────────────────────

describe('topic: /test_topic', () => {
  test('POST /add/topic returns a JSON schema', async () => {
    const schema = await retry(() => post('/add/topic', { name: '/test_topic' }));
    assert.ok(schema.properties, 'expected properties in msg schema');
    assert.equal(schema.properties.data.type, 'string');
  });

  test('POST /call/service publishes without error', async () => {
    const result = await post('/call/service', {
      type: 'topic',
      name: '/test_topic',
      form: { data: 'hello from integration test' },
    });
    assert.deepEqual(result, {});
  });
});

// ── service ───────────────────────────────────────────────────────────

describe('service: /test_set_bool', () => {
  test('POST /add/service returns a JSON schema', async () => {
    const schema = await retry(() => post('/add/service', { name: '/test_set_bool' }));
    assert.ok(schema.properties, 'expected properties in srv schema');
  });

  test('POST /call/service returns success=true', async () => {
    const result = await post('/call/service', {
      type: 'service',
      name: '/test_set_bool',
      form: { data: true },
    });
    assert.equal(result.success, true);
  });

  test('POST /call/service echoes request data in message', async () => {
    const result = await post('/call/service', {
      type: 'service',
      name: '/test_set_bool',
      form: { data: false },
    });
    assert.ok(result.message.toLowerCase().includes('false'));
  });
});

// ── action ────────────────────────────────────────────────────────────

describe('action: /fibonacci', () => {
  test('POST /add/action returns schema with goal/result/feedback', async () => {
    const schema = await retry(() => post('/add/action', { name: '/fibonacci' }));
    assert.ok(schema.goal,     'missing goal');
    assert.ok(schema.result,   'missing result');
    assert.ok(schema.feedback, 'missing feedback');
    assert.equal(schema.goal.order.type, 'integer');
  });

  test('POST /call/action streams feedback then result', { timeout: 15_000 }, async () => {
    const res = await fetch(`${SERVER}/call/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '/fibonacci', form: { order: 5 } }),
    });

    assert.ok(
      res.headers.get('content-type')?.includes('text/event-stream'),
      'expected text/event-stream content type',
    );

    const events = await readSSE(res);
    const feedbacks = events.filter(e => e.event === 'feedback');
    const results   = events.filter(e => e.event === 'result');
    const errors    = events.filter(e => e.event === 'error');

    assert.equal(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
    assert.ok(feedbacks.length > 0, 'expected at least one feedback event');
    assert.equal(results.length, 1, 'expected exactly one result event');
  });

  test('action result contains a sequence array of length 5', { timeout: 15_000 }, async () => {
    const res = await fetch(`${SERVER}/call/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '/fibonacci', form: { order: 5 } }),
    });

    const events = await readSSE(res);
    const resultEvent = events.find(e => e.event === 'result');
    assert.ok(resultEvent, 'no result event received');

    // rclnodejs may wrap as { result: { sequence } } or return { sequence } directly
    const seq = resultEvent.data?.sequence ?? resultEvent.data?.result?.sequence;
    assert.ok(Array.isArray(seq), `expected sequence array, got: ${JSON.stringify(resultEvent.data)}`);
    assert.equal(seq.length, 5);
  });
});