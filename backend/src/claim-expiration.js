export async function syncPublicationStatus(client, publicationIds) {
  await client.query(
    `UPDATE public.publications p
        SET status = CASE WHEN EXISTS (
              SELECT 1 FROM public.claims c WHERE c.publication_id = p.id AND c.status IN ('pending', 'accepted')
            ) THEN 'claimed' ELSE 'open' END,
            updated_at = now()
      WHERE p.id = ANY($1::uuid[]) AND p.status IN ('open', 'claimed')`,
    [publicationIds],
  );
}

export async function expireClaims(database) {
  await database.transaction(async client => {
    const expired = await client.query(
      `UPDATE public.claims SET status = 'expired'
        WHERE status = 'pending' AND expires_at <= now()
        RETURNING publication_id`,
    );
    if (!expired.rowCount) return;
    await syncPublicationStatus(client, [...new Set(expired.rows.map(row => row.publication_id))]);
  });
}

export function expireClaimsMiddleware(database) {
  return async function expireClaimsBeforeRequest(req, res, next) {
    try {
      await expireClaims(database);
    } catch {
      return res.status(503).json({ error: 'No se pudo actualizar el estado de los reclamos.' });
    }
    next();
  };
}
