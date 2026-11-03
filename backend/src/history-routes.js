// Punto 10: GET /history. Casos resueltos de quien pide, con filtros por período y categoría.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createRequireSession } from './require-session.js';
import { parseHistoryQuery, serializeHistoryItem } from './history-rules.js';
import { listHistory } from './history-service.js';

export function historyRouter(database, tokens) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(rateLimit({
    windowMs: 60_000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intentá más tarde.' },
  }));

  router.get('/', createRequireSession(database, tokens), async (req, res) => {
    const { error, value } = parseHistoryQuery(req.query);
    if (error) return res.status(400).json({ error });
    try {
      const { returned, recovered } = await listHistory(database, req.userId, value);
      res.json({
        filters: value,
        returned: returned.map(serializeHistoryItem),
        recovered: recovered.map(serializeHistoryItem),
      });
    } catch {
      res.status(503).json({ error: 'No se pudo cargar tu historial.' });
    }
  });

  return router;
}
