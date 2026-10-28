import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword } from '../src/auth-crypto.js';
import { createSessionTokens } from '../src/session-tokens.js';
import { createLoginService } from '../src/login-service.js';
const secret = 'test-secret-only-for-unit-tests-123456789';

test('scrypt valida la contraseña exacta y rechaza hashes inválidos', async () => {
  const stored = await hashPassword('Test-password-123!');
  assert.equal(await verifyPassword('Test-password-123!', stored), true);
  assert.equal(await verifyPassword('incorrecta', stored), false);
  assert.equal(await verifyPassword('x', 'scrypt$999999999$8$1$abc$abc'), false);
});
test('JWT comprueba firma, vencimiento, audiencia y emisor', () => {
  const tokens = createSessionTokens(secret);
  const payload = tokens.verify(tokens.sign('user-id'));
  assert.equal(payload.sub, 'user-id');
  assert.equal(payload.exp - payload.iat, 3600);
  assert.throws(() => createSessionTokens('another-test-secret-at-least-32-chars').verify(tokens.sign('user-id')));
  for (const options of [
    { issuer: 'hallado-api', audience: 'hallado-mobile', expiresIn: -1 },
    { issuer: 'wrong', audience: 'hallado-mobile', expiresIn: 3600 },
    { issuer: 'hallado-api', audience: 'wrong', expiresIn: 3600 },
  ]) assert.throws(() => tokens.verify(jwt.sign({}, secret, { algorithm:'HS256', ...options })));
});
test('login no revela si existe una cuenta y valida entrada/configuración', async () => {
  const password_hash = await hashPassword('Test-password-123!');
  const tokens = createSessionTokens(secret);
  const unknown = createLoginService({ query: async () => ({ rows: [] }) }, tokens);
  const existing = createLoginService({ query: async () => ({ rows: [{ password_hash, email_verified_at: new Date() }] }) }, tokens);
  const body = { email: 'test@example.com', password: 'incorrecta' };
  assert.deepEqual(await unknown.login(body), await existing.login(body));
  assert.equal((await unknown.login(null)).status, 400);
  assert.equal((await unknown.login({ ...body, password: 'a'.repeat(129) })).status, 400);
  assert.equal((await createLoginService({}, createSessionTokens('')).login(body)).status, 503);
});
