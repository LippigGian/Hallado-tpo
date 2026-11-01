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

  return router;
}
