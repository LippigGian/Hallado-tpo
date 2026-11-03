import express, { Router } from 'express';
import { limiter } from './rate-limit.js';
import { createRequireSession } from './require-session.js';
import { sessionMiddleware } from './request-auth.js';
import { isUuid } from './uuid.js';
import { validatePublication } from './publication-validation.js';
import {
  createPublication, findPublicationPhoto, listUserPublications, renewPublication,
} from './publication-service.js';
import { serializePublication } from './publication-view.js';
import { parseSearchQuery, searchPublications } from './publication-search.js';
import { followPublication, loadPublicationDetail, unfollowPublication } from './publication-detail.js';
import { expireClaimsMiddleware } from './claim-expiration.js';

const CREATE_BODY_LIMIT = '15mb';


// Rutas de publicaciones de los puntos 3 (buscador), 4 (detalle y seguir) y 5 (alta, mis publicaciones, renovar).
export function publicationRouter(database, tokens) {
  const router = Router();
  const requireSession = createRequireSession(database, tokens);
  const authenticated = [requireSession, expireClaimsMiddleware(database)];
  // Buscador y detalle aceptan visitantes sin sesión.
  const optionalSession = [sessionMiddleware(database, tokens, { optional: true }), expireClaimsMiddleware(database)];

  router.get('/:id/photos/:photoId',
    limiter(60_000, 600, 'Demasiadas solicitudes de fotos. Intentá más tarde.'),
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

  router.get('/',
    limiter(60_000, 120, 'Demasiadas búsquedas. Intentá más tarde.'),
    ...optionalSession,
    async (req, res) => {
      const filters = parseSearchQuery(req.query);
      if (filters.error) return res.status(400).json({ error: filters.error });
      try {
        res.json(await searchPublications(database, filters));
      } catch {
        res.status(503).json({ error: 'No se pudo realizar la búsqueda.' });
      }
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

  router.get('/:id', ...optionalSession, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
    try {
      const publication = await loadPublicationDetail(database, req.params.id, req.userId);
      if (!publication) return res.status(404).json({ error: 'Publicación no encontrada.' });
      res.json({ publication });
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

  router.post('/:id/follow', ...authenticated, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
    try {
      const { status, body } = await followPublication(database, req.params.id, req.userId);
      res.status(status).json(body);
    } catch {
      res.status(503).json({ error: 'No se pudo seguir la publicación.' });
    }
  });

  router.delete('/:id/follow', ...authenticated, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
    try {
      const { status, body } = await unfollowPublication(database, req.params.id, req.userId);
      res.status(status).json(body);
    } catch {
      res.status(503).json({ error: 'No se pudo dejar de seguir la publicación.' });
    }
  });

  return router;
}
