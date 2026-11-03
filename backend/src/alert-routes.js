// Punto 9: rutas de alertas (/alerts), publicaciones seguidas (/follows) y novedades
// (/me/novelties). Todas requieren sesión. Seguir y dejar de seguir siguen en
// POST/DELETE /publications/:id/follow (punto 4).
import express, { Router } from 'express';
import { limiter } from './rate-limit.js';
import { createRequireSession } from './require-session.js';
import { expireClaimsMiddleware } from './claim-expiration.js';
import { isUuid } from './uuid.js';
import { parsePage } from './publication-search.js';
import { MAX_ALERTS_PER_USER, validateAlert, validateAlertUpdate } from './alert-validation.js';
import {
  alertPublications, createAlert, deleteAlert, listAlerts, listFollows, loadNovelties, markAlertSeen, setAlertPaused,
} from './alert-service.js';

function validId(req, res, next) {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
  next();
}

export function alertRouter(database, tokens) {
  const router = Router();
  // Se monta en la raíz: el límite y la sesión se aplican por ruta, no con router.use, para no
  // afectar al resto de la API.
  const general = limiter(60_000, 100, 'Demasiadas solicitudes. Intentá más tarde.');
  // expireClaimsMiddleware actualiza los reclamos vencidos antes de leer estados (punto 7).
  const authenticated = [general, createRequireSession(database, tokens), expireClaimsMiddleware(database), (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }];

  router.get('/alerts', ...authenticated, async (req, res) => {
    try {
      res.json({ alerts: await listAlerts(database, req.userId), max_alerts: MAX_ALERTS_PER_USER });
    } catch {
      res.status(503).json({ error: 'No se pudieron cargar tus alertas.' });
    }
  });

  router.post('/alerts',
    limiter(60 * 60_000, 30, 'Guardaste demasiadas alertas seguidas. Intentá más tarde.'),
    ...authenticated,
    express.json({ limit: '10kb' }),
    async (req, res) => {
      const { error, value } = validateAlert(req.body);
      if (error) return res.status(400).json({ error });
      try {
        const result = await createAlert(database, req.userId, value);
        if (result.outcome === 'limit') return res.status(409).json({ error: `Podés tener hasta ${MAX_ALERTS_PER_USER} alertas. Eliminá alguna para guardar otra.`, code: 'limit' });
        if (result.outcome === 'duplicate') return res.status(409).json({ error: 'Ya tenés una alerta con esta búsqueda.', code: 'duplicate' });
        res.status(201).json({ alert: result.alert });
      } catch {
        res.status(503).json({ error: 'No se pudo guardar la alerta. Intentá nuevamente.' });
      }
    });

  router.patch('/alerts/:id', ...authenticated, validId, express.json({ limit: '1kb' }), async (req, res) => {
    const { error, value } = validateAlertUpdate(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const alert = await setAlertPaused(database, req.params.id, req.userId, value.paused);
      if (!alert) return res.status(404).json({ error: 'Alerta no encontrada.' });
      res.json({ alert });
    } catch {
      res.status(503).json({ error: 'No se pudo actualizar la alerta.' });
    }
  });

  router.delete('/alerts/:id', ...authenticated, validId, async (req, res) => {
    try {
      if (!await deleteAlert(database, req.params.id, req.userId)) return res.status(404).json({ error: 'Alerta no encontrada.' });
      res.json({ deleted: true });
    } catch {
      res.status(503).json({ error: 'No se pudo eliminar la alerta.' });
    }
  });

  router.get('/alerts/:id/publications', ...authenticated, validId, async (req, res) => {
    const page = parsePage(req.query.page);
    if (!page) return res.status(400).json({ error: 'Paginación inválida.' });
    try {
      const result = await alertPublications(database, req.params.id, req.userId, page);
      if (!result) return res.status(404).json({ error: 'Alerta no encontrada.' });
      res.json(result);
    } catch {
      res.status(503).json({ error: 'No se pudieron cargar las coincidencias.' });
    }
  });

  router.post('/alerts/:id/seen', ...authenticated, validId, async (req, res) => {
    try {
      const alert = await markAlertSeen(database, req.params.id, req.userId);
      if (!alert) return res.status(404).json({ error: 'Alerta no encontrada.' });
      res.json({ alert });
    } catch {
      res.status(503).json({ error: 'No se pudo actualizar la alerta.' });
    }
  });

  router.get('/follows', ...authenticated, async (req, res) => {
    try {
      res.json({ publications: await listFollows(database, req.userId) });
    } catch {
      res.status(503).json({ error: 'No se pudieron cargar las publicaciones seguidas.' });
    }
  });

  router.get('/me/novelties', ...authenticated, async (req, res) => {
    try {
      res.json(await loadNovelties(database, req.userId));
    } catch {
      res.status(503).json({ error: 'No se pudieron cargar las novedades.' });
    }
  });

  return router;
}
