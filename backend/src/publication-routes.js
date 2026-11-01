import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createRequireSession } from './require-session.js';
import { isUuid } from './uuid.js';
import { validatePublication } from './publication-validation.js';
import {
  createPublication, findPublication, findPublicationPhoto, listUserPublications, renewPublication,
} from './publication-service.js';
import { serializePublication } from './publication-view.js';

// 5 fotos de hasta 2 MB en base64 ocupan unos 14 MB. Solo la ruta de creación acepta un cuerpo tan grande.
const CREATE_BODY_LIMIT = '15mb';

function limiter(windowMs, limit, message) {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: message } });
}

export function publicationRouter(database, tokens) {
  const router = Router();
  const requireSession = createRequireSession(database, tokens);

  // Las fotos son públicas (la app las muestra con <Image source={{ uri }}>) y se piden de a muchas
  // en un listado: tienen un límite propio y se pueden cachear porque una foto nunca cambia.
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

  // "Mis publicaciones": todas las propias, con su estado (abierta, en reclamo, resuelta o vencida).
  router.get('/mine', requireSession, async (req, res) => {
    try {
      const rows = await listUserPublications(database, req.userId);
      res.json({ publications: rows.map(row => serializePublication(row, req.userId)) });
    } catch {
      res.status(503).json({ error: 'No se pudieron cargar tus publicaciones.' });
    }
  });

  // Detalle. Quien no es dueño no recibe la dirección exacta ni la respuesta de verificación.
  router.get('/:id', requireSession, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
    try {
      const row = await findPublication(database, req.params.id);
      if (!row) return res.status(404).json({ error: 'Publicación no encontrada.' });
      res.json({ publication: serializePublication(row, req.userId) });
    } catch {
      res.status(503).json({ error: 'No se pudo cargar la publicación.' });
    }
  });

  // Crear: máximo 20 por hora desde una misma conexión, para frenar abuso.
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

  router.post('/:id/renew', requireSession, async (req, res) => {
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
