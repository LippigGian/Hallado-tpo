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
import { serializeAgreement, validateProposal } from './meeting-point-rules.js';
import { acceptLastProposal, addProposal, listProposals } from './meeting-point-service.js';
import { confirmReturn } from './return-service.js';

const CREATE_BODY_LIMIT = '4mb';

const CREATE_FAILURES = {
  not_found: { status: 404, error: 'Publicación no encontrada.' },
  own_publication: { status: 403, error: 'No podés reclamar tu propia publicación.' },
  closed: { status: 409, error: 'La publicación ya no admite reclamos.' },
  attempts_exhausted: { status: 409, error: `Ya usaste los ${CLAIM_RULES.maxAttempts} intentos de reclamo para esta publicación.` },
  already_pending: { status: 409, error: 'Ya tenés un reclamo pendiente en esta publicación.' },
};

// Punto 8: acuerdo del punto de encuentro.
const MEETING_FAILURES = {
  not_found: { status: 404, error: 'Reclamo no encontrado.' },
  claim_not_accepted: { status: 409, error: 'El punto de encuentro se acuerda una vez aceptado el reclamo.' },
  already_agreed: { status: 409, error: 'El punto de encuentro ya fue acordado.' },
  not_holder: { status: 409, error: 'El primer punto de encuentro lo propone quien tiene el objeto.' },
  own_turn: { status: 409, error: 'Esperá la respuesta de la otra persona antes de proponer otro punto.' },
  no_proposal: { status: 409, error: 'Todavía no hay un punto de encuentro propuesto.' },
  own_proposal: { status: 409, error: 'No podés aceptar tu propia propuesta.' },
};

// Punto 10: devolución concretada.
const RETURN_FAILURES = {
  not_found: { status: 404, error: 'Reclamo no encontrado.' },
  claim_not_accepted: { status: 409, error: 'La devolución se confirma una vez aceptado el reclamo.' },
  not_recoverer: { status: 403, error: 'La devolución la confirma quien recupera el objeto.' },
  already_returned: { status: 409, error: 'La devolución ya fue confirmada.' },
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

  async function sendAgreement(res, claim, userId, status = 200) {
    res.status(status).json({ meeting_point: serializeAgreement(claim, await listProposals(database, claim.id), userId) });
  }

  router.get('/:id/meeting-point', ...authenticated, async (req, res) => {
    try {
      const claim = await loadParticipantClaim(req, res);
      if (claim) await sendAgreement(res, claim, req.userId);
    } catch {
      res.status(503).json({ error: 'No se pudo cargar el punto de encuentro.' });
    }
  });

  router.post('/:id/meeting-point/proposals', ...authenticated, express.json({ limit: '10kb' }), async (req, res) => {
    try {
      const claim = await loadParticipantClaim(req, res);
      if (!claim) return;
      const { error, value } = validateProposal(req.body);
      if (error) return res.status(400).json({ error });
      const result = await addProposal(database, claim.id, req.userId, value);
      const failure = MEETING_FAILURES[result.outcome];
      if (failure) return res.status(failure.status).json({ error: failure.error });
      await sendAgreement(res, claim, req.userId, 201);
    } catch {
      res.status(503).json({ error: 'No se pudo guardar la propuesta. Intentá nuevamente.' });
    }
  });

  router.post('/:id/meeting-point/accept', ...authenticated, async (req, res) => {
    try {
      const claim = await loadParticipantClaim(req, res);
      if (!claim) return;
      const result = await acceptLastProposal(database, claim.id, req.userId);
      const failure = MEETING_FAILURES[result.outcome];
      if (failure) return res.status(failure.status).json({ error: failure.error });
      await sendAgreement(res, claim, req.userId);
    } catch {
      res.status(503).json({ error: 'No se pudo confirmar el punto de encuentro. Intentá nuevamente.' });
    }
  });

  router.post('/:id/return', ...authenticated, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
    try {
      const result = await confirmReturn(database, req.params.id, req.userId);
      const failure = RETURN_FAILURES[result.outcome];
      if (failure) return res.status(failure.status).json({ error: failure.error });
      res.json({ claim: serializeClaim(await findClaim(database, req.params.id), req.userId) });
    } catch {
      res.status(503).json({ error: 'No se pudo confirmar la devolución. Intentá nuevamente.' });
    }
  });

  router.post('/:id/accept', ...authenticated, decisionHandler('accept'));
  router.post('/:id/reject', ...authenticated, decisionHandler('reject'));

  return router;
}
