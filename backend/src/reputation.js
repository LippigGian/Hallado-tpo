// Integración interna: invocar con el cliente de la transacción del caso de uso.
// El módulo que confirma devolución/valoración debe comprobar permisos y estado.
// No exponer esta función en un endpoint de edición de perfil.
export async function recordReputationEvent(client, { userId, type, sourceId, authorId = null, value = 1, message = '' }) {
  return client.query(`INSERT INTO public.reputation_events(user_id,event_type,source_id,author_id,value,message)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,event_type,source_id) DO NOTHING RETURNING id`,
    [userId,type,sourceId,authorId,value,message]);
}
export async function readReputation(database, userId) {
  const result = await database.query(`SELECT
    count(*) FILTER (WHERE event_type='return')::integer AS completed_returns,
    count(*) FILTER (WHERE event_type='rating' AND value=1)::integer AS positive_ratings,
    count(*) FILTER (WHERE event_type='rating' AND value=-1)::integer AS negative_ratings
    FROM public.reputation_events WHERE user_id=$1`, [userId]);
  const counts=result.rows[0];
  const thanks=await database.query(`SELECT e.id,e.message,e.created_at,coalesce(nullif(u.name,''),'Vecino de Hallado') AS author_name
    FROM public.reputation_events e LEFT JOIN public.users u ON u.id=e.author_id
    WHERE e.user_id=$1 AND e.event_type='thanks' ORDER BY e.created_at DESC LIMIT 20`,[userId]);
  return { ...counts, score:counts.completed_returns+counts.positive_ratings-counts.negative_ratings,
    badges:counts.completed_returns>=5?[{id:'solidary_neighbor',name:'Vecino solidario'}]:[], thanks:thanks.rows };
}
