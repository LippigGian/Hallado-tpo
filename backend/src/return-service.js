// Punto 10: devolución concretada. La confirma quien recupera el objeto sobre un reclamo
// aceptado (punto 7). En la misma transacción: registra el caso, resuelve la publicación y
// suma la devolución a la reputación de quien devolvió (punto 2).
import { recordReputationEvent } from './reputation.js';
import { recovererId, returnerId, returnOutcome } from './return-rules.js';

// outcome: 'returned' | 'not_found' | 'claim_not_accepted' | 'not_recoverer' | 'already_returned'.
export async function confirmReturn(database, claimId, userId) {
  return database.transaction(async client => {
    // Bloquea el reclamo y la publicación: dos confirmaciones simultáneas no crean dos casos.
    const found = await client.query(
      `SELECT c.id, c.kind, c.status, c.claimant_id, c.publication_id, p.user_id AS publisher_id,
              EXISTS (SELECT 1 FROM public.returns r WHERE r.claim_id = c.id OR r.publication_id = c.publication_id) AS already_returned
         FROM public.claims c JOIN public.publications p ON p.id = c.publication_id
        WHERE c.id = $1 FOR UPDATE OF c, p`,
      [claimId],
    );
    const claim = found.rows[0];
    if (!claim) return { outcome: 'not_found' };
    const outcome = returnOutcome(claim, userId, claim.already_returned);
    if (outcome !== 'ok') return { outcome };

    const returner = returnerId(claim);
    const inserted = await client.query(
      `INSERT INTO public.returns (claim_id, publication_id, returner_id, recoverer_id)
       VALUES ($1, $2, $3, $4) RETURNING id, returned_at`,
      [claim.id, claim.publication_id, returner, recovererId(claim)],
    );
    const returnRow = inserted.rows[0];
    await client.query(
      "UPDATE public.publications SET status = 'resolved', updated_at = now() WHERE id = $1",
      [claim.publication_id],
    );
    await recordReputationEvent(client, { userId: returner, type: 'return', sourceId: returnRow.id, authorId: userId });
    return { outcome: 'returned', returnId: returnRow.id, returnedAt: returnRow.returned_at };
  });
}
