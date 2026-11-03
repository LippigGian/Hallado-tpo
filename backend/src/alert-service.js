// Punto 9: alertas de búsqueda, publicaciones seguidas e indicador de novedades.
// Las coincidencias de una alerta usan las mismas condiciones que el buscador (searchConditions),
// sin contar las publicaciones de la propia persona.
import { MAX_ALERTS_PER_USER } from './alert-validation.js';
import {
  oppositeType, photoUrl, searchConditions, searchPublications, searchTerms,
  SQL_APPROX_LAT, SQL_APPROX_LNG, SQL_OCCURRED_ON, SQL_PHOTO_IDS, SQL_STATUS, SQL_TIME_SLOT,
} from './publication-search.js';

// Las fechas se devuelven como texto AAAA-MM-DD: `pg` convierte `date` a Date en la zona local
// del servidor y podría correrlas un día.
// `last_seen_exact`: last_seen_at como texto con microsegundos, para compararlo en SQL. Un Date
// de JavaScript solo tiene milisegundos: si se usara, una publicación creada en el mismo
// milisegundo pero antes de la última vista contaría como nueva.
const ALERT_COLUMNS = `id,situation,category,neighborhood,keywords,date_preset,
  to_char(date_from,'YYYY-MM-DD') AS date_from,to_char(date_to,'YYYY-MM-DD') AS date_to,paused,last_seen_at,
  last_seen_at::text AS last_seen_exact,created_at`;

const lastSeen = row => row.last_seen_exact ?? row.last_seen_at;

// Criterios de la alerta -> filtros del buscador.
export function alertFilters(row) {
  return {
    type: oppositeType(row.situation),
    category: row.category,
    terms: searchTerms(row.keywords || ''),
    neighborhood: row.neighborhood,
    from: row.date_from,
    to: row.date_to,
  };
}

export function serializeAlert(row, newCount) {
  return {
    id: row.id,
    situation: row.situation,
    category: row.category,
    neighborhood: row.neighborhood,
    keywords: row.keywords,
    date_preset: row.date_preset,
    date_from: row.date_from,
    date_to: row.date_to,
    paused: row.paused,
    // Una alerta pausada no avisa: no muestra publicaciones nuevas.
    new_count: row.paused ? 0 : newCount,
    last_seen_at: row.last_seen_at,
    created_at: row.created_at,
  };
}

async function countNewMatches(database, row, userId) {
  if (row.paused) return 0;
  const values = [];
  const param = value => { values.push(value); return `$${values.length}`; };
  const where = searchConditions(alertFilters(row), param);
  where.push(`p.user_id<>${param(userId)}`, `p.created_at>${param(lastSeen(row))}::timestamptz`);
  const result = await database.query(`SELECT count(*)::integer AS c FROM public.publications p WHERE ${where.join(' AND ')}`, values);
  return result.rows[0]?.c ?? 0;
}

async function withCount(database, row, userId) {
  return serializeAlert(row, await countNewMatches(database, row, userId));
}

async function findAlert(database, id, userId) {
  const result = await database.query(`SELECT ${ALERT_COLUMNS} FROM public.search_alerts WHERE id=$1 AND user_id=$2`, [id, userId]);
  return result.rows[0] || null;
}

export async function listAlerts(database, userId) {
  const result = await database.query(
    `SELECT ${ALERT_COLUMNS} FROM public.search_alerts WHERE user_id=$1 ORDER BY created_at DESC, id`,
    [userId],
  );
  const alerts = [];
  for (const row of result.rows) alerts.push(await withCount(database, row, userId));
  return alerts;
}

// outcome: 'created' | 'limit' | 'duplicate'.
export async function createAlert(database, userId, value) {
  return database.transaction(async client => {
    // Bloquea a la persona para que dos altas simultáneas no superen el tope.
    await client.query('SELECT 1 FROM public.users WHERE id=$1 FOR UPDATE', [userId]);
    const count = await client.query('SELECT count(*)::integer AS c FROM public.search_alerts WHERE user_id=$1', [userId]);
    if (count.rows[0].c >= MAX_ALERTS_PER_USER) return { outcome: 'limit' };
    // ON CONFLICT DO NOTHING en vez de capturar el error, para no abortar la transacción.
    const inserted = await client.query(
      `INSERT INTO public.search_alerts(user_id,situation,category,neighborhood,keywords,date_preset,date_from,date_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING ${ALERT_COLUMNS}`,
      [userId, value.situation, value.category, value.neighborhood, value.keywords, value.date_preset, value.date_from, value.date_to],
    );
    if (!inserted.rowCount) return { outcome: 'duplicate' };
    return { outcome: 'created', alert: serializeAlert(inserted.rows[0], 0) };
  });
}

// Al reanudar una alerta pausada se toma como vista en ese momento: lo publicado mientras
// estuvo pausada no se acumula como novedad.
export async function setAlertPaused(database, id, userId, paused) {
  const result = await database.query(
    `UPDATE public.search_alerts
        SET last_seen_at = CASE WHEN paused AND NOT $3::boolean THEN now() ELSE last_seen_at END,
            paused = $3::boolean
      WHERE id=$1 AND user_id=$2 RETURNING ${ALERT_COLUMNS}`,
    [id, userId, paused],
  );
  if (!result.rowCount) return null;
  return withCount(database, result.rows[0], userId);
}

export async function deleteAlert(database, id, userId) {
  const result = await database.query('DELETE FROM public.search_alerts WHERE id=$1 AND user_id=$2 RETURNING id', [id, userId]);
  return result.rowCount > 0;
}

export async function markAlertSeen(database, id, userId) {
  const result = await database.query(
    `UPDATE public.search_alerts SET last_seen_at=now() WHERE id=$1 AND user_id=$2 RETURNING ${ALERT_COLUMNS}`,
    [id, userId],
  );
  return result.rowCount ? serializeAlert(result.rows[0], 0) : null;
}

// Coincidencias de la alerta, las más recientes primero, marcando con `is_new` las publicadas
// desde la última vez que se abrió. No marca la alerta como vista: la app llama a
// POST /alerts/:id/seen después de mostrar la primera página y calcula `is_new` de las
// siguientes con el `last_seen_at` que tenía la alerta al abrirla.
export async function alertPublications(database, id, userId, page = 1) {
  const row = await findAlert(database, id, userId);
  if (!row) return null;
  const search = await searchPublications(database, {
    ...alertFilters(row),
    sort: 'created',
    lat: null,
    lng: null,
    page,
    pageSize: 10,
    excludeUserId: userId,
    newSince: row.paused ? null : lastSeen(row),
  });
  const results = search.results.map(result => ({ ...result, is_new: Boolean(result.is_new) }));
  return { alert: await withCount(database, row, userId), ...search, results };
}

// Seguidas: hay novedad cuando el estado actual (open, claimed, expired o resolved) es distinto
// del último que vio la persona. Las que tienen novedad van primero.
const SQL_FOLLOW_UPDATE = `(f.last_seen_status IS NOT NULL AND f.last_seen_status<>${SQL_STATUS})`;

export async function listFollows(database, userId) {
  const result = await database.query(
    `SELECT p.id,p.type,p.title,p.category,p.neighborhood,p.occurred_at,${SQL_OCCURRED_ON} AS occurred_on,
        ${SQL_TIME_SLOT} AS time_slot,${SQL_STATUS} AS status,${SQL_APPROX_LAT} AS approx_latitude,
        ${SQL_APPROX_LNG} AS approx_longitude,p.created_at,${SQL_PHOTO_IDS} AS photo_ids,
        f.created_at AS followed_at,f.last_seen_status,${SQL_FOLLOW_UPDATE} AS has_update
      FROM public.publication_follows f JOIN public.publications p ON p.id=f.publication_id
      WHERE f.user_id=$1
      ORDER BY has_update DESC, f.created_at DESC, p.id
      LIMIT 100`,
    [userId],
  );
  return result.rows.map(row => ({
    id: row.id,
    type: row.type,
    title: row.title,
    category: row.category,
    neighborhood: row.neighborhood,
    occurred_at: row.occurred_at,
    occurred_on: row.occurred_on,
    time_slot: row.time_slot,
    status: row.status,
    approx_latitude: row.approx_latitude,
    approx_longitude: row.approx_longitude,
    created_at: row.created_at,
    photos: (row.photo_ids || []).map(photoId => ({ id: photoId, url: photoUrl(row.id, photoId) })),
    followed_at: row.followed_at,
    previous_status: row.last_seen_status,
    has_update: Boolean(row.has_update),
  }));
}

// Lo llama el detalle (punto 4) cuando lo abre alguien que sigue la publicación.
export async function markFollowSeen(database, publicationId, userId, status) {
  await database.query(
    `UPDATE public.publication_follows SET last_seen_status=$3
      WHERE publication_id=$1 AND user_id=$2 AND last_seen_status IS DISTINCT FROM $3`,
    [publicationId, userId, status],
  );
}

// Totales para los indicadores del Menú.
export async function loadNovelties(database, userId) {
  const alerts = await listAlerts(database, userId);
  const follows = await database.query(
    `SELECT count(*)::integer AS c FROM public.publication_follows f JOIN public.publications p ON p.id=f.publication_id
      WHERE f.user_id=$1 AND ${SQL_FOLLOW_UPDATE}`,
    [userId],
  );
  const withNews = alerts.filter(alert => alert.new_count > 0);
  return {
    alerts: {
      new_publications: withNews.reduce((sum, alert) => sum + alert.new_count, 0),
      with_news: withNews.length,
    },
    follows: { updated: follows.rows[0]?.c ?? 0 },
  };
}
