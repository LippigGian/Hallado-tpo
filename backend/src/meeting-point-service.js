import { acceptOutcome, proposalOutcome } from './meeting-point-rules.js';

const SELECT_PROPOSALS = `SELECT id, claim_id, proposed_by, address, schedule, reference, accepted_at, created_at
  FROM public.meeting_point_proposals WHERE claim_id = $1 ORDER BY created_at, id`;

// Datos del reclamo que necesitan las reglas; FOR UPDATE serializa dos respuestas simultáneas.
async function lockClaim(client, claimId) {
  const result = await client.query(
    `SELECT c.id, c.kind, c.status, c.claimant_id, p.user_id AS publisher_id
       FROM public.claims c JOIN public.publications p ON p.id = c.publication_id
      WHERE c.id = $1 FOR UPDATE OF c`,
    [claimId],
  );
  return result.rows[0] || null;
}

export async function listProposals(database, claimId) {
  return (await database.query(SELECT_PROPOSALS, [claimId])).rows;
}

export async function addProposal(database, claimId, userId, value) {
  return database.transaction(async client => {
    const claim = await lockClaim(client, claimId);
    if (!claim) return { outcome: 'not_found' };
    const proposals = (await client.query(SELECT_PROPOSALS, [claimId])).rows;
    const outcome = proposalOutcome(claim, proposals, userId);
    if (outcome !== 'ok') return { outcome };
    await client.query(
      'INSERT INTO public.meeting_point_proposals (claim_id, proposed_by, address, schedule, reference) VALUES ($1, $2, $3, $4, $5)',
      [claimId, userId, value.address, value.schedule, value.reference],
    );
    return { outcome: 'ok' };
  });
}

export async function acceptLastProposal(database, claimId, userId) {
  return database.transaction(async client => {
    const claim = await lockClaim(client, claimId);
    if (!claim) return { outcome: 'not_found' };
    const proposals = (await client.query(SELECT_PROPOSALS, [claimId])).rows;
    const outcome = acceptOutcome(claim, proposals, userId);
    if (outcome !== 'ok') return { outcome };
    await client.query('UPDATE public.meeting_point_proposals SET accepted_at = now() WHERE id = $1', [proposals.at(-1).id]);
    return { outcome: 'ok' };
  });
}
