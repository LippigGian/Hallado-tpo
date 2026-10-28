import { createOtp, createToken, equalHash, hashPassword, normalizeEmail, otpHash, tokenHash } from './auth-crypto.js';

const fail = (status, error, extra = {}) => ({ status, body: { error, ...extra } });
const success = (status, body) => ({ status, body });

export function createRecoveryService(database, { secret, mailer, now = () => Date.now() }) {
  function ready() { return secret?.length >= 32 && mailer && database.transaction; }
  async function lockEmail(client, email) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), 2)', [email]);
  }
  return {
    async requestCode(body = {}) {
      const email = normalizeEmail(body?.email);
      if (!email) return fail(400, 'Ingresá un email válido.');
      if (!ready()) return fail(503, 'El servicio de recuperación no está configurado.');
      return database.transaction(async client => {
        await lockEmail(client, email);
        const existing = await client.query('SELECT id FROM public.users WHERE email=$1', [email]);
        if (!existing.rowCount) return success(202, { message: 'Si existe una cuenta con ese email, recibirás un código.', expiresIn: 300, resendAfter: 30 });
        const latest = await client.query("SELECT created_at FROM public.auth_verifications WHERE email=$1 AND purpose='password_reset' ORDER BY created_at DESC LIMIT 1", [email]);
        const wait = latest.rowCount ? Math.ceil((new Date(latest.rows[0].created_at).getTime() + 30000 - now()) / 1000) : 0;
        if (wait > 0) return success(202, { message: 'Si existe una cuenta con ese email, recibirás un código.', expiresIn: 300, resendAfter: 30 });
        const code = createOtp();
        // Reenviar invalida códigos y permisos de registro anteriores de este email.
        await client.query("DELETE FROM public.auth_verifications WHERE email=$1 AND purpose='password_reset'", [email]);
        await client.query("INSERT INTO public.auth_verifications(email,purpose,code_hash,expires_at) VALUES ($1,'password_reset',$2,now()+interval '5 minutes')", [email, otpHash(secret, email, code, 'password_reset')]);
        // Un fallo SMTP revierte la transacción; no queda un código nuevo inutilizable.
        try { await mailer.sendCode(email, code, 'password_reset'); } catch { throw Object.assign(new Error('Mail unavailable'), { code: 'MAIL_UNAVAILABLE' }); }
        return success(202, { message: 'Si existe una cuenta con ese email, recibirás un código.', expiresIn: 300, resendAfter: 30 });
      });
    },
    async verifyCode(body = {}) {
      const email = normalizeEmail(body?.email);
      if (!email || typeof body?.code !== 'string' || !/^\d{6}$/.test(body.code)) return fail(400, 'Ingresá un email válido y un código de seis dígitos.');
      if (!ready()) return fail(503, 'El servicio de recuperación no está configurado.');
      return database.transaction(async client => {
        await lockEmail(client, email);
        const result = await client.query("SELECT *, now() AS database_now FROM public.auth_verifications WHERE email=$1 AND purpose='password_reset' ORDER BY created_at DESC LIMIT 1 FOR UPDATE", [email]);
        const verification = result.rows[0];
        if (!verification || verification.used_at || verification.verified_at || new Date(verification.expires_at) <= new Date(verification.database_now)) return fail(400, 'El código no está disponible o venció. Solicitá uno nuevo.');
        if (verification.attempts >= verification.max_attempts) return fail(429, 'Se agotaron los intentos. Solicitá un código nuevo.');
        if (!equalHash(verification.code_hash, otpHash(secret, email, body.code, 'password_reset'))) {
          await client.query('UPDATE public.auth_verifications SET attempts=attempts+1 WHERE id=$1', [verification.id]);
          return fail(verification.attempts + 1 >= verification.max_attempts ? 429 : 400, 'Código incorrecto.', { attemptsRemaining: verification.max_attempts - verification.attempts - 1 });
        }
        const resetToken = createToken();
        await client.query("UPDATE public.auth_verifications SET verified_at=now(), reset_token_hash=$2, expires_at=now()+interval '10 minutes' WHERE id=$1", [verification.id, tokenHash(resetToken)]);
        return success(200, { resetToken, expiresIn: 600 });
      });
    },
    async complete(body = {}) {
      if (typeof body?.resetToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.resetToken)) return fail(400, 'Falta un permiso de recuperación válido.');
      if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128 || !body.password.trim()) return fail(400, 'Usá una contraseña de 8 a 128 caracteres, no solo espacios.');
      if (body.password !== body.passwordConfirmation) return fail(400, 'Las contraseñas no coinciden.');
      if (!ready()) return fail(503, 'El servicio de recuperación no está configurado.');
      const passwordHash = await hashPassword(body.password);
      return database.transaction(async client => {
        const found = await client.query("SELECT *, now() AS database_now FROM public.auth_verifications WHERE reset_token_hash=$1 AND purpose='password_reset' FOR UPDATE", [tokenHash(body.resetToken)]);
        const verification = found.rows[0];
        if (!verification || !verification.verified_at || verification.used_at || new Date(verification.expires_at) <= new Date(verification.database_now)) return fail(400, 'El permiso de recuperación venció o ya fue utilizado.');
        const updated = await client.query('UPDATE public.users SET password_hash=$2, session_version=session_version+1 WHERE email=$1 RETURNING id', [verification.email, passwordHash]);
        if (!updated.rowCount) return fail(400, 'El permiso de recuperación ya no es válido.');
        await client.query('UPDATE public.auth_verifications SET used_at=now(), reset_token_hash=NULL WHERE id=$1', [verification.id]);
        return success(200, { message: 'Contraseña actualizada. Iniciá sesión con tu nueva contraseña.' });
      });
    },
  };
}
