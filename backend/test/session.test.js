import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';
const secret = 'session-unit-test-secret-123456789012345';
const id = '00000000-0000-4000-8000-000000000001';
test('restaurar sesión exige JWT válido y usuario existente', async t => {
  let exists = true;
  const tokens = createSessionTokens(secret);
  const database = { query: async () => ({ rowCount: exists ? 1 : 0, rows: exists ? [{ id,email:'test@example.invalid' }] : [] }) };
  const server = createApp(database, undefined, undefined, tokens).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  async function request(token) { return fetch(`http://127.0.0.1:${server.address().port}/auth/me`, { headers: token ? { Authorization:`Bearer ${token}` } : {} }); }
  assert.equal((await request()).status,401);
  assert.equal((await request('invalid')).status,401);
  const expired = jwt.sign({},secret,{ algorithm:'HS256',subject:id,issuer:'hallado-api',audience:'hallado-mobile',expiresIn:-1 });
  assert.equal((await request(expired)).status,401);
  const ok = await request(tokens.sign(id));
  assert.equal(ok.status,200);
  assert.equal((await ok.json()).user.id,id);
  exists = false;
  assert.equal((await request(tokens.sign(id))).status,401);
});
