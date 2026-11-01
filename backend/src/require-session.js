import { isUuid } from './uuid.js';

// Middleware reutilizable: exige un JWT válido y deja el id del usuario en req.userId.
// Lo usan las rutas de publicaciones y lo pueden usar reclamos, alertas y el resto.
export function createRequireSession(database, tokens) {
  return async function requireSession(req, res, next) {
    if (!tokens.ready) return res.status(503).json({ error: 'Sesión no configurada.' });

    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    let payload;
    try {
      payload = tokens.verify(match?.[1] || '');
    } catch {
      return res.status(401).json({ error: 'Sesión inválida o vencida.' });
    }
    if (!isUuid(payload.sub)) return res.status(401).json({ error: 'Sesión inválida o vencida.' });

    try {
      const result = await database.query('SELECT session_version FROM public.users WHERE id=$1', [payload.sub]);
      // Si cambió la contraseña, session_version cambió y los tokens anteriores dejan de valer.
      if (!result.rowCount || (payload.ver ?? 0) !== result.rows[0].session_version) {
        return res.status(401).json({ error: 'Sesión inválida o vencida.' });
      }
    } catch {
      return res.status(503).json({ error: 'No se pudo validar la sesión.' });
    }

    req.userId = payload.sub;
    next();
  };
}
