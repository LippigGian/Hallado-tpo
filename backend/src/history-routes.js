// Punto 10: GET /history (casos resueltos, con filtros por período y categoría) y, por caso,
// POST /history/:id/rating y POST /history/:id/thanks. :id es el id de la devolución.
import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createRequireSession } from './require-session.js';
import { parseHistoryQuery, serializeHistoryItem } from './history-rules.js';
import { listHistory } from './history-service.js';
import { isUuid } from './uuid.js';
import { validateRating, validateThanks } from './feedback-rules.js';
import { sendFeedback } from './feedback-service.js';

const FEEDBACK_FAILURES = {
  not_found: { status: 404, error: 'Caso no encontrado.' },
  not_recoverer: { status: 403, error: 'El agradecimiento lo deja quien recuperó el objeto.' },
  window_closed: { status: 409, error: 'Pasaron más de 7 días desde la devolución.' },
};
const ALREADY_SENT = {
  rating: 'Ya valoraste este caso.',
  thanks: 'Ya dejaste tu agradecimiento en este caso.',
};

export function historyRouter(database, tokens) {
  const router = Router();
  const authenticated = createRequireSession(database, tokens);
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(rateLimit({
    windowMs: 60_000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intentá más tarde.' },
  }));

  router.get('/', authenticated, async (req, res) => {
    const { error, value } = parseHistoryQuery(req.query);
    if (error) return res.status(400).json({ error });
    try {
      const { returned, recovered } = await listHistory(database, req.userId, value);
      res.json({
        filters: value,
        returned: returned.map(row => serializeHistoryItem(row, 'returner')),
        recovered: recovered.map(row => serializeHistoryItem(row, 'recoverer')),
      });
    } catch {
      res.status(503).json({ error: 'No se pudo cargar tu historial.' });
    }
  });

  function feedbackHandler(kind, validate) {
    return async (req, res) => {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
      const { error, value } = validate(req.body);
      if (error) return res.status(400).json({ error });
      try {
        const result = await sendFeedback(database, req.params.id, req.userId, kind, value);
        if (result.outcome === 'already_sent') return res.status(409).json({ error: ALREADY_SENT[kind] });
        const failure = FEEDBACK_FAILURES[result.outcome];
        if (failure) return res.status(failure.status).json({ error: failure.error });
        res.status(201).json({ ok: true });
      } catch {
        res.status(503).json({ error: 'No se pudo guardar. Intentá nuevamente.' });
      }
    };
  }

  const json = express.json({ limit: '10kb' });
  router.post('/:id/rating', authenticated, json, feedbackHandler('rating', validateRating));
  router.post('/:id/thanks', authenticated, json, feedbackHandler('thanks', validateThanks));

  return router;
}
