import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export const SESSION_SECONDS = 3600;
const ISSUER = 'hallado-api';
const AUDIENCE = 'hallado-mobile';

export function createSessionTokens(secret) {
  const ready = typeof secret === 'string' && secret.length >= 32;
  return {
    ready,
    sign(userId) {
      if (!ready) throw new Error('JWT_SECRET no configurado.');
      return jwt.sign({}, secret, { algorithm: 'HS256', subject: userId, issuer: ISSUER,
        audience: AUDIENCE, expiresIn: SESSION_SECONDS, jwtid: randomUUID() });
    },
    verify(token) {
      if (!ready) throw new Error('JWT_SECRET no configurado.');
      return jwt.verify(token, secret, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
    },
  };
}
