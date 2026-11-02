export const PUBLICATION_DAYS = 30;

const SELECT_PUBLICATION = `
  SELECT p.id, p.user_id, p.type, p.title, p.description, p.category, p.occurred_at,
         p.neighborhood, p.address, p.latitude, p.longitude,
         p.verification_question, p.verification_answer, p.expires_at, p.created_at,
         CASE WHEN p.status = 'open' AND p.expires_at <= now() THEN 'expired' ELSE p.status END AS status,
         coalesce(
           (SELECT json_agg(ph.id ORDER BY ph.sort_order)
              FROM public.publication_photos ph WHERE ph.publication_id = p.id),
           '[]'::json
         ) AS photo_ids
    FROM public.publications p`;

export async function findPublication(database, id) {
  const result = await database.query(`${SELECT_PUBLICATION} WHERE p.id = $1`, [id]);
  return result.rows[0] || null;
}

export async function listUserPublications(database, userId) {
  const result = await database.query(
    `${SELECT_PUBLICATION} WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT 100`,
    [userId],
  );
  return result.rows;
}

export async function createPublication(database, userId, data) {
  const id = await database.transaction(async client => {
    const inserted = await client.query(
      `INSERT INTO public.publications
         (user_id, type, title, description, category, occurred_at, neighborhood, address,
          latitude, longitude, verification_question, verification_answer, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now() + $13::int * interval '1 day')
       RETURNING id`,
      [userId, data.type, data.title, data.description, data.category, data.occurred_at,
        data.neighborhood, data.address, data.latitude, data.longitude,
        data.verification_question, data.verification_answer, PUBLICATION_DAYS],
    );
    const publicationId = inserted.rows[0].id;
    for (const [index, photo] of data.photos.entries()) {
      await client.query(
        'INSERT INTO public.publication_photos (publication_id, sort_order, mime, data) VALUES ($1, $2, $3, $4)',
        [publicationId, index, photo.mime, photo.data],
      );
    }
    return publicationId;
  });
  return findPublication(database, id);
}

export async function renewPublication(database, id, userId) {
  const updated = await database.query(
    `UPDATE public.publications
        SET expires_at = now() + $3::int * interval '1 day', updated_at = now()
      WHERE id = $1 AND user_id = $2 AND status = 'open'
      RETURNING id`,
    [id, userId, PUBLICATION_DAYS],
  );
  if (updated.rowCount) return { outcome: 'renewed', publication: await findPublication(database, id) };

  const owned = await database.query('SELECT 1 FROM public.publications WHERE id = $1 AND user_id = $2', [id, userId]);
  return { outcome: owned.rowCount ? 'conflict' : 'not_found' };
}

export async function findPublicationPhoto(database, publicationId, photoId) {
  const result = await database.query(
    'SELECT mime, data FROM public.publication_photos WHERE publication_id = $1 AND id = $2',
    [publicationId, photoId],
  );
  return result.rows[0] || null;
}
