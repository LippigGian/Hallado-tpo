import { Router } from 'express';

export function sessionRouter(database, tokens) {
  const router = Router();
  router.get('/me', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!tokens.ready) return res.status(503).json({ error:'Servicio de sesión no configurado.' });
    const authorization = req.headers.authorization || '';
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match) return res.status(401).json({ error:'Sesión inválida o vencida.' });
    let payload;
    try { payload = tokens.verify(match[1]); } catch { return res.status(401).json({ error:'Sesión inválida o vencida.' }); }
    if (typeof payload.sub !== 'string' || !/^[a-f0-9-]{36}$/i.test(payload.sub)) return res.status(401).json({ error:'Sesión inválida o vencida.' });
    try {
      const result = await database.query('SELECT id,email,created_at,session_version FROM public.users WHERE id=$1', [payload.sub]);
      if (!result.rowCount) return res.status(401).json({ error:'Sesión inválida o vencida.' });
      const user = result.rows[0];
      if ((payload.ver ?? 0) !== (user.session_version ?? 0)) return res.status(401).json({ error:'Sesión inválida o vencida.' });
      res.json({ user: { id:user.id, email:user.email, created_at:user.created_at } });
    } catch { res.status(503).json({ error:'No se pudo comprobar la sesión. Intentá más tarde.' }); }
  });
  return router;
}
