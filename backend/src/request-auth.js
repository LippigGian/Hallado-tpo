// Autenticación compartida por routers que no viven bajo /profiles (ver profile-routes.js,
// que tiene su propia copia histórica de este mismo patrón y no se toca acá).
export const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function sessionMiddleware(database, tokens, { optional = false } = {}) {
  return async function authenticate(req, res, next) {
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    if (!match) {
      if (optional) { req.userId = null; return next(); }
      return res.status(401).json({ error: 'Sesión inválida o vencida.' });
    }
    if (!tokens.ready) return res.status(503).json({ error: 'Sesión no configurada.' });
    let payload;
    try { payload = tokens.verify(match[1]); } catch { return res.status(401).json({ error: 'Sesión inválida o vencida.' }); }
    if (!uuid.test(payload.sub || '')) return res.status(401).json({ error: 'Sesión inválida o vencida.' });
    try {
      const user = await database.query('SELECT id,session_version FROM public.users WHERE id=$1', [payload.sub]);
      if (!user.rowCount || (payload.ver ?? 0) !== user.rows[0].session_version) return res.status(401).json({ error: 'Sesión inválida o vencida.' });
      req.userId = payload.sub;
      next();
    } catch { res.status(503).json({ error: 'No se pudo validar la sesión.' }); }
  };
}
