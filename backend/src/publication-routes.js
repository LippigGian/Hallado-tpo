import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { parseSearchQuery, searchPublications } from './publication-search.js';
import { sessionMiddleware, uuid } from './request-auth.js';

export function publicationRouter(database, tokens) {
  const router = Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const authenticateOptional = sessionMiddleware(database, tokens, { optional: true });

  router.get('/', rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiadas búsquedas. Intentá más tarde.' } }),
    authenticateOptional, async (req, res) => {
      const filters = parseSearchQuery(req.query);
      if (filters.error) return res.status(400).json({ error: filters.error });
      try {
        res.json(await searchPublications(database, filters));
      } catch { res.status(503).json({ error: 'No se pudo realizar la búsqueda.' }); }
    });

  router.get('/:id/photos/:photoId', rateLimit({ windowMs: 60000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiadas solicitudes de fotos. Intentá más tarde.' } }),
    async (req, res) => {
      if (!uuid.test(req.params.id) || !uuid.test(req.params.photoId)) return res.status(400).json({ error: 'Identificador inválido.' });
      try {
        const result = await database.query('SELECT photo_data,photo_mime FROM public.publication_photos WHERE id=$1 AND publication_id=$2', [req.params.photoId, req.params.id]);
        if (!result.rowCount) return res.status(404).json({ error: 'Foto no disponible.' });
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Cache-Control', 'public, max-age=86400');
        res.type(result.rows[0].photo_mime).send(result.rows[0].photo_data);
      } catch { res.status(503).json({ error: 'No se pudo cargar la foto.' }); }
    });

import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createRequireSession } from './require-session.js';
import { isUuid } from './uuid.js';
import { validatePublication } from './publication-validation.js';
import {
  createPublication, findPublication, findPublicationPhoto, listUserPublications, renewPublication,
} from './publication-service.js';
import { serializePublication } from './publication-view.js';
import { expireClaimsMiddleware } from './claim-expiration.js';
import { hasAcceptedClaim } from './claim-service.js';

const CREATE_BODY_LIMIT = '15mb';

function limiter(windowMs, limit, message) {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: message } });
}

export function publicationRouter(database, tokens) {
  const router = Router();
  const requireSession = createRequireSession(database, tokens);
  const authenticated = [requireSession, expireClaimsMiddleware(database)];

  router.get('/:id/photos/:photoId',
    limiter(60_000, 300, 'Demasiadas solicitudes de fotos. Intentá más tarde.'),
    async (req, res) => {
      if (!isUuid(req.params.id) || !isUuid(req.params.photoId)) return res.status(400).json({ error: 'Identificador inválido.' });
      try {
        const photo = await findPublicationPhoto(database, req.params.id, req.params.photoId);
        if (!photo) return res.status(404).json({ error: 'Foto no disponible.' });
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Cache-Control', 'public, max-age=86400, immutable');
        res.type(photo.mime).send(photo.data);
      } catch {
        res.status(503).json({ error: 'No se pudo cargar la foto.' });
      }
    });

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(limiter(60_000, 100, 'Demasiadas solicitudes. Intentá más tarde.'));

  router.get('/mine', ...authenticated, async (req, res) => {
    try {
      const rows = await listUserPublications(database, req.userId);
      res.json({ publications: rows.map(row => serializePublication(row, req.userId)) });
    } catch {
      res.status(503).json({ error: 'No se pudieron cargar tus publicaciones.' });
    }
  });

  router.get('/:id', ...authenticated, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
    try {
      const row = await findPublication(database, req.params.id);
      if (!row) return res.status(404).json({ error: 'Publicación no encontrada.' });
      const exactLocation = await hasAcceptedClaim(database, row.id, req.userId);
      res.json({ publication: serializePublication(row, req.userId, { exactLocation }) });
    } catch {
      res.status(503).json({ error: 'No se pudo cargar la publicación.' });
    }
  });

  router.post('/',
    limiter(60 * 60_000, 20, 'Publicaste demasiadas veces seguidas. Intentá más tarde.'),
    requireSession,
    express.json({ limit: CREATE_BODY_LIMIT }),
    async (req, res) => {
      const { error, value } = validatePublication(req.body);
      if (error) return res.status(400).json({ error });
      try {
        const row = await createPublication(database, req.userId, value);
        res.status(201).json({ publication: serializePublication(row, req.userId) });
      } catch {
        res.status(503).json({ error: 'No se pudo guardar la publicación. Intentá nuevamente.' });
      }
    });

  router.post('/:id/renew', ...authenticated, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
    try {
      const result = await renewPublication(database, req.params.id, req.userId);
      if (result.outcome === 'not_found') return res.status(404).json({ error: 'Publicación no encontrada.' });
      if (result.outcome === 'conflict') return res.status(409).json({ error: 'Solo se pueden renovar publicaciones abiertas o vencidas.' });
      res.json({ publication: serializePublication(result.publication, req.userId) });
    } catch {
      res.status(503).json({ error: 'No se pudo renovar la publicación.' });
    }
  });

  return router;
}
