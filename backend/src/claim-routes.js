import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createRequireSession } from './require-session.js';
import { expireClaimsMiddleware } from './claim-expiration.js';
import { CLAIM_RULES, claimKindFor } from './claim-rules.js';
import { validateClaim } from './claim-validation.js';
import { createClaim, decideClaim, findClaim, findClaimPhoto, listClaims } from './claim-service.js';
import { isParticipant, serializeClaim } from './claim-view.js';
import { findPublication } from './publication-service.js';
import { isUuid } from './uuid.js';

const CREATE_BODY_LIMIT = '4mb';

const CREATE_FAILURES = {
  not_found: { status: 404, error: 'Publicación no encontrada.' },
  own_publication: { status: 403, error: 'No podés reclamar tu propia publicación.' },
  closed: { status: 409, error: 'La publicación ya no admite reclamos.' },
  attempts_exhausted: { status: 409, error: `Ya usaste los ${CLAIM_RULES.maxAttempts} intentos de reclamo para esta publicación.` },
  already_pending: { status: 409, error: 'Ya tenés un reclamo pendiente en esta publicación.' },
};

const DECISION_FAILURES = {
  not_found: { status: 404, error: 'Reclamo no encontrado.' },
  not_pending: { status: 409, error: 'Este reclamo ya fue respondido o venció.' },
};

function limiter(windowMs, limit, message) {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: message } });
}

export function claimRouter(database, tokens) {
  const router = Router();
  const authenticated = [createRequireSession(database, tokens), expireClaimsMiddleware(database)];

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(limiter(60_000, 100, 'Demasiadas solicitudes. Intentá más tarde.'));

  async function loadParticipantClaim(req, res) {
    if (!isUuid(req.params.id)) {
      res.status(400).json({ error: 'Identificador inválido.' });
      return null;
    }
    const row = await findClaim(database, req.params.id);
    if (!row || !isParticipant(row, req.userId)) {
      res.status(404).json({ error: 'Reclamo no encontrado.' });
      return null;
    }
    return row;
  }

  function decisionHandler(decision) {
    return async (req, res) => {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
      try {
        const result = await decideClaim(database, req.params.id, req.userId, decision);
        const failure = DECISION_FAILURES[result.outcome];
        if (failure) return res.status(failure.status).json({ error: failure.error });
        res.json({ claim: serializeClaim(await findClaim(database, req.params.id), req.userId) });
      } catch {
        res.status(503).json({ error: 'No se pudo registrar tu respuesta. Intentá nuevamente.' });
      }
    };
  }

  router.get('/mine', ...authenticated, async (req, res) => {
    try {
      const { sent, received } = await listClaims(database, req.userId);
      res.json({
        sent: sent.map(row => serializeClaim(row, req.userId)),
        received: received.map(row => serializeClaim(row, req.userId)),
      });
    } catch {
      res.status(503).json({ error: 'No se pudieron cargar tus reclamos.' });
    }
  });

  router.get('/:id/photo', ...authenticated, async (req, res) => {
    try {
      const claim = await loadParticipantClaim(req, res);
      if (!claim) return;
      const photo = await findClaimPhoto(database, claim.id);
      if (!photo) return res.status(404).json({ error: 'Foto no disponible.' });
      res.set('X-Content-Type-Options', 'nosniff');
      res.type(photo.mime).send(photo.data);
    } catch {
      res.status(503).json({ error: 'No se pudo cargar la foto.' });
    }
  });

  router.get('/:id', ...authenticated, async (req, res) => {
    try {
      const claim = await loadParticipantClaim(req, res);
      if (claim) res.json({ claim: serializeClaim(claim, req.userId) });
    } catch {
      res.status(503).json({ error: 'No se pudo cargar el reclamo.' });
    }
  });

  router.post('/',
    limiter(60 * 60_000, 30, 'Hiciste demasiados reclamos seguidos. Intentá más tarde.'),
    ...authenticated,
    express.json({ limit: CREATE_BODY_LIMIT }),
    async (req, res) => {
      const publicationId = req.body?.publication_id;
      if (!isUuid(publicationId)) return res.status(400).json({ error: 'Indicá la publicación que querés reclamar.' });
      try {
        const publication = await findPublication(database, publicationId);
        if (!publication) return res.status(404).json({ error: CREATE_FAILURES.not_found.error });
        if (publication.user_id === req.userId) return res.status(403).json({ error: CREATE_FAILURES.own_publication.error });

        const { error, value } = validateClaim(req.body, claimKindFor(publication.type));
        if (error) return res.status(400).json({ error });

        const result = await createClaim(database, req.userId, publicationId, value);
        const failure = CREATE_FAILURES[result.outcome];
        if (failure) return res.status(failure.status).json({ error: failure.error });

        res.status(201).json({ claim: serializeClaim(await findClaim(database, result.claimId), req.userId) });
      } catch {
        res.status(503).json({ error: 'No se pudo guardar el reclamo. Intentá nuevamente.' });
      }
    });

  router.post('/:id/accept', ...authenticated, decisionHandler('accept'));
  router.post('/:id/reject', ...authenticated, decisionHandler('reject'));

  return router;
}
