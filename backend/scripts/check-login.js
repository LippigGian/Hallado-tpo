import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { hashPassword } from '../src/auth-crypto.js';
import { createApp } from '../src/app.js';
import { createLoginService } from '../src/login-service.js';
import { createSessionTokens } from '../src/session-tokens.js';
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('Configurar DATABASE_URL y JWT_SECRET.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('BEGIN');
const tokens = createSessionTokens(process.env.JWT_SECRET);
const database = { query: (text, values) => client.query(text, values) };
const service = createLoginService(database, tokens);
const server = createApp(database, undefined, service).listen(0, '127.0.0.1');
await once(server, 'listening');
const email = `login-${randomUUID()}@example.invalid`;
const password = 'Test-local-password-123!';
async function post(body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  return { status:response.status, body:await response.json(), cache:response.headers.get('cache-control') };
}
try {
  const inserted = await client.query('INSERT INTO public.users(email,password_hash,email_verified_at) VALUES ($1,$2,now()) RETURNING id', [email, await hashPassword(password)]);
  const ok = await post({ email: `  ${email.toUpperCase()}  `, password });
  assert.equal(ok.status, 200);
  assert.equal(ok.cache, 'no-store');
  assert.equal(ok.body.user.email, email);
  assert.equal(ok.body.user.password_hash, undefined);
  assert.equal(ok.body.expiresIn, 3600);
  assert.equal(ok.body.tokenType, 'Bearer');
  assert.equal(tokens.verify(ok.body.token).sub, inserted.rows[0].id);
  const bad = await post({ email, password:'wrong' });
  const absent = await post({ email:`absent-${randomUUID()}@example.invalid`, password });
  assert.equal(bad.status, 401);
  assert.deepEqual(bad.body, absent.body);
  assert.equal((await post({ email:'invalid', password })).status, 400);
  let limited;
  for (let index=0; index<7; index++) limited=await post({});
  assert.equal(limited.status, 429);
  console.log('Login HTTP/PostgreSQL verificado: credenciales válidas/incorrectas, email normalizado, JWT firmado, datos públicos, validación y límite 429.');
} finally {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await client.query('ROLLBACK');
  await client.end();
  console.log('Usuario temporal descartado con ROLLBACK. No se modificó ninguna cuenta existente.');
}
