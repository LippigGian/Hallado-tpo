// Punto 10: historial de casos resueltos de una persona, separado en "Devolví" y "Recuperé".
const LIST_LIMIT = 100;
const ZONA = "'America/Argentina/Buenos_Aires'";

// role: 'returner' (Devolví) o 'recoverer' (Recuperé). La contraparte es la otra persona.
function historyQuery(role) {
  const mine = role === 'returner' ? 'r.returner_id' : 'r.recoverer_id';
  const other = role === 'returner' ? 'r.recoverer_id' : 'r.returner_id';
  return `
    SELECT r.id, r.claim_id, r.returned_at, r.publication_id,
           p.type AS publication_type, p.title AS publication_title, p.category AS publication_category,
           (SELECT ph.id FROM public.publication_photos ph WHERE ph.publication_id = p.id ORDER BY ph.sort_order LIMIT 1) AS cover_photo_id,
           u.id AS counterpart_id, u.name AS counterpart_name
      FROM public.returns r
      JOIN public.publications p ON p.id = r.publication_id
      JOIN public.users u ON u.id = ${other}
     WHERE ${mine} = $1
       AND ($2::date IS NULL OR (r.returned_at AT TIME ZONE ${ZONA})::date >= $2::date)
       AND ($3::text IS NULL OR p.category = $3)
     ORDER BY r.returned_at DESC
     LIMIT ${LIST_LIMIT}`;
}

export async function listHistory(database, userId, { date_from: dateFrom, category }) {
  const values = [userId, dateFrom, category];
  const [returned, recovered] = await Promise.all([
    database.query(historyQuery('returner'), values),
    database.query(historyQuery('recoverer'), values),
  ]);
  return { returned: returned.rows, recovered: recovered.rows };
}
