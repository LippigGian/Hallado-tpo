// Punto 10: historial de casos resueltos y, por caso, valoraciones y agradecimientos.
//   GET  /history                  casos de quien pide, con filtros por período y categoría
//   POST /returns/:id/rating       valorar a la otra parte del caso (:id = id de la devolución)
//   POST /returns/:id/thanks       agradecimiento público de quien recuperó
// Se monta en la raíz (como las alertas): el límite y la sesión se aplican por ruta.
import express, { Router } from 'express';
import { limiter } from './rate-limit.js';
import { createRequireSession } from './require-session.js';
import { isUuid } from './uuid.js';
import { parseHistoryQuery, serializeHistoryItem } from './history-rules.js';
import { listHistory } from './history-service.js';
import { validateRating, validateThanks } from './feedback-rules.js';
import { sendFeedback } from './feedback-service.js';

// outcome de sendFeedback -> respuesta. 'already_sent' depende de si es valoración o agradecimiento.
const FEEDBACK_FAILURES = {
  not_found: { status: 404, error: () => 'Caso no encontrado.' },
  not_recoverer: { status: 403, error: () => 'El agradecimiento lo deja quien recuperó el objeto.' },
  window_closed: { status: 409, error: () => 'Pasaron más de 7 días desde la devolución.' },
  already_sent: { status: 409, error: kind => (kind === 'rating' ? 'Ya valoraste este caso.' : 'Ya dejaste tu agradecimiento en este caso.') },
};

export function historyRouter(database, tokens) {
  const router = Router();
  const authenticated = [limiter(60_000, 100, 'Demasiadas solicitudes. Intentá más tarde.'), createRequireSession(database, tokens), (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }];

  router.get('/history', ...authenticated, async (req, res) => {
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
        const { outcome } = await sendFeedback(database, req.params.id, req.userId, kind, value);
        const failure = FEEDBACK_FAILURES[outcome];
        if (failure) return res.status(failure.status).json({ error: failure.error(kind) });
        res.status(201).json({ ok: true });
      } catch {
        res.status(503).json({ error: 'No se pudo guardar. Intentá nuevamente.' });
      }
    };
  }

  const json = express.json({ limit: '10kb' });
  router.post('/returns/:id/rating', ...authenticated, json, feedbackHandler('rating', validateRating));
  router.post('/returns/:id/thanks', ...authenticated, json, feedbackHandler('thanks', validateThanks));

  return router;
}
