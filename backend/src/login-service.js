import { hashPassword, normalizeEmail, verifyPassword } from './auth-crypto.js';
import { randomBytes } from 'node:crypto';
import { SESSION_SECONDS } from './session-tokens.js';

// Mismo cálculo costoso para email inexistente que para contraseña incorrecta.
const dummyHash = hashPassword(randomBytes(32).toString('hex'));

export function createLoginService(database, tokens) {
  return {
    async login(body = {}) {
      const email = normalizeEmail(body?.email);
      const password = body?.password;
      if (!email || typeof password !== 'string' || password.length === 0 || password.length > 128) {
        return { status: 400, body: { error: 'Ingresá un email válido y una contraseña de hasta 128 caracteres.' } };
      }
      if (!tokens.ready) return { status: 503, body: { error: 'El servicio de sesión no está configurado.' } };
      const result = await database.query('SELECT id,email,password_hash,email_verified_at,created_at,session_version FROM public.users WHERE email=$1', [email]);
      const user = result.rows[0];
      const valid = await verifyPassword(password, user?.password_hash || await dummyHash);
      if (!user || !valid || !user.email_verified_at) {
        return { status: 401, body: { error: 'Email o contraseña incorrectos.' } };
      }
      return { status: 200, body: {
        token: tokens.sign(user.id, user.session_version), tokenType: 'Bearer', expiresIn: SESSION_SECONDS,
        user: { id: user.id, email: user.email, created_at: user.created_at },
      } };
    },
  };
}
