import { CLAIM_RULES } from './claim-rules.js';
import { syncPublicationStatus } from './claim-expiration.js';
import { grantAcceptedClaimContact } from './profile-contact.js';

const LIST_LIMIT = 100;

const SELECT_CLAIM = `
  SELECT c.id, c.publication_id, c.claimant_id, c.kind, c.status, c.verification_answer, c.description,
         c.found_neighborhood, c.photo_data IS NOT NULL AS has_photo, c.created_at, c.expires_at, c.responded_at,
         p.user_id AS publisher_id, p.type AS publication_type, p.title AS publication_title,
         p.category AS publication_category, p.neighborhood AS publication_neighborhood,
         p.address AS publication_address, p.latitude AS publication_latitude, p.longitude AS publication_longitude,
         p.verification_question, p.verification_answer AS expected_answer,
         (SELECT ph.id FROM public.publication_photos ph WHERE ph.publication_id = p.id ORDER BY ph.sort_order LIMIT 1) AS cover_photo_id,
         claimant.name AS claimant_name, publisher.name AS publisher_name
    FROM public.claims c
    JOIN public.publications p ON p.id = c.publication_id
    JOIN public.users claimant ON claimant.id = c.claimant_id
    JOIN public.users publisher ON publisher.id = p.user_id`;

export async function findClaim(database, id) {
  const result = await database.query(`${SELECT_CLAIM} WHERE c.id = $1`, [id]);
  return result.rows[0] || null;
}

export async function listClaims(database, userId) {
  const query = filter => database.query(
    `${SELECT_CLAIM} WHERE ${filter} = $1 ORDER BY c.created_at DESC LIMIT ${LIST_LIMIT}`,
    [userId],
  );
  const [sent, received] = await Promise.all([query('c.claimant_id'), query('p.user_id')]);
  return { sent: sent.rows, received: received.rows };
}

export async function findClaimPhoto(database, claimId) {
  const result = await database.query(
    'SELECT photo_mime AS mime, photo_data AS data FROM public.claims WHERE id = $1 AND photo_data IS NOT NULL',
    [claimId],
  );
  return result.rows[0] || null;
}

export async function hasAcceptedClaim(database, publicationId, userId) {
  const result = await database.query(
    `SELECT 1 FROM public.claims WHERE publication_id = $1 AND claimant_id = $2 AND status = 'accepted'`,
    [publicationId, userId],
  );
  return result.rowCount > 0;
}

export async function createClaim(database, userId, publicationId, data) {
  return database.transaction(async client => {
    const publication = await client.query(
      `SELECT user_id, status, (status = 'open' AND expires_at <= now()) AS expired
         FROM public.publications WHERE id = $1 FOR UPDATE`,
      [publicationId],
    );
    const row = publication.rows[0];
    if (!row) return { outcome: 'not_found' };
    if (row.user_id === userId) return { outcome: 'own_publication' };

    const history = await client.query(
      `SELECT count(*) FILTER (WHERE claimant_id = $2)::int AS attempts,
              count(*) FILTER (WHERE claimant_id = $2 AND status = 'pending')::int AS pending,
              count(*) FILTER (WHERE status = 'accepted')::int AS accepted
         FROM public.claims WHERE publication_id = $1`,
      [publicationId, userId],
    );
    const { attempts, pending, accepted } = history.rows[0];

    if (row.expired || row.status === 'resolved' || accepted > 0) return { outcome: 'closed' };
    if (attempts >= CLAIM_RULES.maxAttempts) return { outcome: 'attempts_exhausted' };
    if (pending > 0) return { outcome: 'already_pending' };

    const inserted = await client.query(
      `INSERT INTO public.claims
         (publication_id, claimant_id, kind, verification_answer, description, found_neighborhood,
          photo_data, photo_mime, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + $9::int * interval '1 hour')
       RETURNING id`,
      [publicationId, userId, data.kind, data.verification_answer, data.description, data.found_neighborhood,
        data.photo?.data ?? null, data.photo?.mime ?? null, CLAIM_RULES.hoursToExpire],
    );
    await syncPublicationStatus(client, [publicationId]);
    return { outcome: 'created', claimId: inserted.rows[0].id };
  });
}

const DECISION_STATUS = { accept: 'accepted', reject: 'rejected' };

export async function decideClaim(database, claimId, userId, decision) {
  return database.transaction(async client => {
    const found = await client.query(
      `SELECT c.status, c.publication_id, c.claimant_id, p.user_id AS publisher_id, c.expires_at <= now() AS expired
         FROM public.claims c JOIN public.publications p ON p.id = c.publication_id
        WHERE c.id = $1 FOR UPDATE OF c, p`,
      [claimId],
    );
    const claim = found.rows[0];
    if (!claim || claim.publisher_id !== userId) return { outcome: 'not_found' };
    if (claim.status !== 'pending' || claim.expired) return { outcome: 'not_pending' };

    await client.query('UPDATE public.claims SET status = $2, responded_at = now() WHERE id = $1', [claimId, DECISION_STATUS[decision]]);
    if (decision === 'accept') {
      await client.query(
        `UPDATE public.claims SET status = 'rejected', responded_at = now()
          WHERE publication_id = $1 AND status = 'pending' AND id <> $2`,
        [claim.publication_id, claimId],
      );
      await grantAcceptedClaimContact(client, claimId, claim.publisher_id, claim.claimant_id);
    }
    await syncPublicationStatus(client, [claim.publication_id]);
    return { outcome: 'done' };
  });
}
