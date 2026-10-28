import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { createDatabase } from '../src/database.js';

async function request(t, database, path) {
  const server = createApp(database).listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
  return { status: response.status, body: await response.json() };
}

test('health responde aunque PostgreSQL falle', async t => {
  const result = await request(t, { check: async () => { throw new Error('offline'); } }, '/health');
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'ok');
});
test('db sin configurar devuelve 503', async t => {
  const result = await request(t, createDatabase(''), '/health/db');
  assert.equal(result.status, 503);
  assert.equal(result.body.database, 'not_configured');
});
test('db conectada devuelve 200', async t => {
  const result = await request(t, { check: async () => ({ status: 'connected' }) }, '/health/db');
  assert.equal(result.status, 200);
  assert.equal(result.body.database, 'connected');
});
test('db inaccesible devuelve 503 sin exponer secretos', async t => {
  const result = await request(t, { check: async () => { throw new Error('password=secreto'); } }, '/health/db');
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { status: 'unavailable', database: 'disconnected' });
});
test('ruta inexistente devuelve JSON y 404', async t => {
  const result = await request(t, createDatabase(''), '/no-existe');
  assert.equal(result.status, 404);
});
test('config rechaza puertos y URLs inválidos', () => {
  for (const port of ['0', '65536', 'abc', '3.5']) assert.throws(() => readConfig({ PORT: port }));
  assert.throws(() => readConfig({ DATABASE_URL: 'https://example.com' }));
  assert.equal(readConfig({}).port, 3000);
});
