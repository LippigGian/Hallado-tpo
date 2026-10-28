import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { createRegistrationService } from '../src/registration-service.js';

if (!process.env.DATABASE_URL || !process.env.OTP_SECRET) throw new Error('Configurar DATABASE_URL y OTP_SECRET en .env.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('BEGIN');
// Todas las operaciones de este test permanecen en una transacción externa que se revierte.
const database = {
  async transaction(callback) {
    await client.query('SAVEPOINT registration_test');
    try { return await callback(client); }
    catch (error) { await client.query('ROLLBACK TO SAVEPOINT registration_test'); throw error; }
  },
};
const sent = [];
let failMail = false;
const mailer = { async sendCode(email, code) { if (failMail) throw new Error('Test SMTP failure'); sent.push({ email, code }); } };
const service = createRegistrationService(database, { secret: process.env.OTP_SECRET, mailer });
const server = createApp(database, service).listen(0, '127.0.0.1');
await once(server, 'listening');
const email = `registration-${randomUUID()}@example.invalid`;
let assertions = 0;
function check(actual, expected) { assert.deepEqual(actual, expected); assertions++; }
async function post(path, body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/auth/register/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
try {
  check((await post('request-code', { email: 'invalid' })).status, 400);
  let response = await post('request-code', { email: email.toUpperCase() });
  check(response.status, 202);
  check(response.body.code, undefined);
  check(sent[0].email, email);
  check((await post('request-code', { email })).status, 429);
  check((await post('verify-code', { email, code: '12' })).status, 400);
  const wrongCode = sent[0].code === '000000' ? '111111' : '000000';
  for (let attempt = 1; attempt <= 5; attempt++) {
    response = await post('verify-code', { email, code: wrongCode });
    check(response.status, attempt === 5 ? 429 : 400);
    check(response.body.attemptsRemaining, 5 - attempt);
  }
  check((await post('verify-code', { email, code: sent[0].code })).status, 429);
  await client.query("UPDATE public.auth_verifications SET created_at=now()-interval '31 seconds' WHERE email=$1", [email]);
  check((await post('request-code', { email })).status, 202);
  await client.query("UPDATE public.auth_verifications SET created_at=now()-interval '6 minutes', expires_at=now()-interval '1 minute' WHERE email=$1", [email]);
  check((await post('verify-code', { email, code: sent.at(-1).code })).status, 400);
  check((await post('request-code', { email })).status, 202);
  response = await post('verify-code', { email, code: sent.at(-1).code });
  check(response.status, 200);
  const registrationToken = response.body.registrationToken;
  check(typeof registrationToken, 'string');
  check((await post('verify-code', { email, code: sent.at(-1).code })).status, 400);
  const password = 'Prueba-local-123!';
  check((await post('complete', { registrationToken, password: 'short', passwordConfirmation: 'short' })).status, 400);
  check((await post('complete', { registrationToken, password, passwordConfirmation: 'different' })).status, 400);
  response = await post('complete', { registrationToken, password, passwordConfirmation: password });
  check(response.status, 201);
  check(response.body.user.email, email);
  check(response.body.user.password_hash, undefined);
  const user = (await client.query('SELECT password_hash FROM public.users WHERE email=$1', [email])).rows[0];
  check(user.password_hash.startsWith('scrypt$'), true);
  check(user.password_hash.includes(password), false);
  check((await post('complete', { registrationToken, password, passwordConfirmation: password })).status, 400);
  check((await post('request-code', { email })).status, 409);
  failMail = true;
  const otherEmail = `mail-failure-${randomUUID()}@example.invalid`;
  check((await post('request-code', { email: otherEmail })).status, 503);
  check((await client.query('SELECT id FROM public.auth_verifications WHERE email=$1', [otherEmail])).rowCount, 0);
  console.log(`${assertions} verificaciones HTTP/PostgreSQL correctas: registro, OTP, expiración, intentos, reenvío, hashes, uso único y fallo de correo.`);
} finally {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await client.query('ROLLBACK');
  await client.end();
  console.log('Datos de prueba descartados con ROLLBACK. No se enviaron emails.');
}
