export const CATEGORIES = ['documents', 'keys', 'electronics', 'pets', 'clothing', 'other'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LATLNG_RE = /^-?\d+(\.\d+)?$/;

function validDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Palabras clave -> términos de búsqueda: sin tildes, en minúsculas, de 2 letras o más, hasta 5.
// La usan el buscador (punto 3) y las alertas (punto 9).
export function searchTerms(text) {
  if (typeof text !== 'string') return [];
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).filter(t => t.length >= 2).slice(0, 5);
}

// Lo que le pasó a quien busca -> tipo de publicación que le sirve (perdí algo -> encontradas).
export function oppositeType(situation) {
  return situation === 'lost' ? 'found' : 'lost';
}

// Devuelve { error } o los filtros ya validados y normalizados.
export function parseSearchQuery(query = {}) {
  for (const key of Object.keys(query)) {
    if (Array.isArray(query[key])) return { error: 'Parámetros de búsqueda inválidos.' };
  }

  if (query.situation !== 'lost' && query.situation !== 'found') return { error: 'Indicá si perdiste o encontraste algo.' };
  // La búsqueda devuelve el tipo opuesto a lo que le pasó a quien busca.
  const type = oppositeType(query.situation);

  let category = null;
  if (query.category !== undefined && query.category !== '') {
    if (!CATEGORIES.includes(query.category)) return { error: 'Categoría inválida.' };
    category = query.category;
  }

  let terms = [];
  if (query.q !== undefined && query.q !== '') {
    if (typeof query.q !== 'string' || query.q.length > 100) return { error: 'Las palabras clave admiten hasta 100 caracteres.' };
    terms = searchTerms(query.q);
  }

  let neighborhood = null;
  if (query.neighborhood !== undefined && query.neighborhood !== '') {
    if (typeof query.neighborhood !== 'string') return { error: 'Barrio o localidad inválido.' };
    const trimmed = query.neighborhood.trim();
    if (!trimmed || trimmed.length > 100) return { error: 'Barrio o localidad inválido.' };
    neighborhood = trimmed;
  }

  let from = null, to = null;
  if (query.from !== undefined && query.from !== '') {
    if (typeof query.from !== 'string' || !validDate(query.from)) return { error: 'Revisá el rango de fechas (formato AAAA-MM-DD).' };
    from = query.from;
  }
  if (query.to !== undefined && query.to !== '') {
    if (typeof query.to !== 'string' || !validDate(query.to)) return { error: 'Revisá el rango de fechas (formato AAAA-MM-DD).' };
    to = query.to;
  }
  if (from && to && from > to) return { error: 'La fecha inicial no puede ser posterior a la final.' };

  let sort = 'recent';
  if (query.sort !== undefined && query.sort !== '') {
    if (query.sort !== 'recent' && query.sort !== 'nearest') return { error: 'Orden inválido.' };
    sort = query.sort;
  }

  let lat = null, lng = null;
  const hasLat = query.lat !== undefined && query.lat !== '';
  const hasLng = query.lng !== undefined && query.lng !== '';
  if (hasLat !== hasLng) return { error: 'Ubicación inválida.' };
  if (hasLat && hasLng) {
    if (typeof query.lat !== 'string' || typeof query.lng !== 'string' || !LATLNG_RE.test(query.lat) || !LATLNG_RE.test(query.lng)) return { error: 'Ubicación inválida.' };
    lat = Number(query.lat);
    lng = Number(query.lng);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { error: 'Ubicación inválida.' };
  }
  if (sort === 'nearest' && lat === null) return { error: 'Para ordenar por cercanía indicá una ubicación.' };

  let page = 1;
  if (query.page !== undefined && query.page !== '') {
    if (typeof query.page !== 'string' || !/^\d+$/.test(query.page)) return { error: 'Paginación inválida.' };
    page = Number(query.page);
    if (page < 1 || page > 500) return { error: 'Paginación inválida.' };
  }
  let pageSize = 10;
  if (query.page_size !== undefined && query.page_size !== '') {
    if (typeof query.page_size !== 'string' || !/^\d+$/.test(query.page_size)) return { error: 'Paginación inválida.' };
    pageSize = Number(query.page_size);
    if (pageSize < 1 || pageSize > 30) return { error: 'Paginación inválida.' };
  }

  return { type, situation: query.situation, category, terms, neighborhood, from, to, sort, lat, lng, page, pageSize };
}

// Esquema de publicaciones del punto 5 (006_publications.sql): occurred_at es fecha y hora,
// address es la dirección exacta y el vencimiento se calcula con expires_at. Estas expresiones
// derivan los campos que usan el buscador y el detalle sin guardar datos duplicados.
const ZONA = "'America/Argentina/Buenos_Aires'";
export const SQL_OCCURRED_ON = `to_char(p.occurred_at AT TIME ZONE ${ZONA},'YYYY-MM-DD')`;
const SQL_OCCURRED_DATE = `(p.occurred_at AT TIME ZONE ${ZONA})::date`;
export const SQL_TIME_SLOT = `CASE
    WHEN extract(hour FROM p.occurred_at AT TIME ZONE ${ZONA}) < 6 THEN 'early_morning'
    WHEN extract(hour FROM p.occurred_at AT TIME ZONE ${ZONA}) < 12 THEN 'morning'
    WHEN extract(hour FROM p.occurred_at AT TIME ZONE ${ZONA}) < 19 THEN 'afternoon'
    ELSE 'night' END`;
export const SQL_STATUS = "CASE WHEN p.status = 'open' AND p.expires_at <= now() THEN 'expired' ELSE p.status END";
// Coordenadas públicas redondeadas a ~1 km: nunca se publica el punto exacto.
export const SQL_APPROX_LAT = 'round(p.latitude::numeric, 2)::double precision';
export const SQL_APPROX_LNG = 'round(p.longitude::numeric, 2)::double precision';
export const SQL_PHOTO_IDS = "coalesce((SELECT array_agg(f.id::text ORDER BY f.sort_order) FROM public.publication_photos f WHERE f.publication_id=p.id),'{}')";

export function photoUrl(publicationId, photoId) {
  return `/publications/${publicationId}/photos/${photoId}`;
}

// Condiciones SQL de una búsqueda sobre `public.publications p`: solo publicaciones visibles
// (abiertas sin vencer o en reclamo) que cumplen los criterios. `param(valor)` agrega el valor a
// la lista de la consulta y devuelve su marcador ($n). La comparten el buscador (punto 3) y las
// alertas (punto 9), así una alerta coincide exactamente con lo que mostraría la búsqueda.
// Barrio comparable: sin espacios en los extremos, en minúsculas y sin tildes. El buscador elige
// el barrio de una lista ("Agronomía") pero al publicar se escribe a mano ("agronomia ").
const sqlComparableNeighborhood = expr => `translate(lower(btrim(${expr})),'áéíóúüñ','aeiouun')`;

export function searchConditions({ type, category, terms = [], neighborhood, from, to }, param) {
  const where = [`p.type=${param(type)}`, "(p.status='claimed' OR (p.status='open' AND p.expires_at>now()))"];
  if (category) where.push(`p.category=${param(category)}`);
  if (neighborhood) where.push(`${sqlComparableNeighborhood('p.neighborhood')}=${sqlComparableNeighborhood(param(neighborhood))}`);
  if (from) where.push(`${SQL_OCCURRED_DATE}>=${param(from)}::date`);
  if (to) where.push(`${SQL_OCCURRED_DATE}<=${param(to)}::date`);
  for (const term of terms) {
    const escaped = term.replace(/[\\%_]/g, match => '\\' + match);
    where.push(`translate(lower(p.title||' '||p.description),'áéíóúüñ','aeiouun') LIKE ${param(`%${escaped}%`)} ESCAPE '\\'`);
  }
  return where;
}

// `excludeUserId`, `newSince` y sort 'created' no llegan desde la query pública: los usan las
// alertas para no mostrar las publicaciones propias y marcar las nuevas (`is_new`).
export async function searchPublications(database, filters) {
  const { sort, lat, lng, page, pageSize, excludeUserId = null, newSince = null } = filters;
  const values = [];
  const param = value => { values.push(value); return `$${values.length}`; };
  const where = searchConditions(filters, param);
  if (excludeUserId) where.push(`p.user_id<>${param(excludeUserId)}`);
  const isNewExpr = newSince ? `(p.created_at>${param(newSince)}::timestamptz)` : 'NULL::boolean';

  let distanceExpr = 'NULL::double precision';
  if (lat !== null) {
    const latParam = param(lat), lngParam = param(lng);
    // Distancia aproximada (fórmula equirectangular) sobre las coordenadas ya redondeadas a ~1km,
    // así ninguna consulta repetida permite triangular el punto exacto. Sin coordenadas queda NULL y va al final.
    distanceExpr = `round((sqrt(power((${SQL_APPROX_LAT}-${latParam})*111.32,2)+power((${SQL_APPROX_LNG}-${lngParam})*111.32*cos(radians(${latParam})),2)))::numeric,1)::double precision`;
  }
  const order = sort === 'nearest' ? 'distance_km ASC NULLS LAST, p.occurred_at DESC, p.id'
    : sort === 'created' ? 'p.created_at DESC, p.id'
      : 'p.occurred_at DESC, p.created_at DESC, p.id';
  const limitParam = param(pageSize);
  const offsetParam = param((page - 1) * pageSize);

  const sql = `SELECT p.id,p.type,p.title,p.category,p.neighborhood,p.occurred_at,${SQL_OCCURRED_ON} AS occurred_on,${SQL_TIME_SLOT} AS time_slot,
      ${SQL_STATUS} AS status,${SQL_APPROX_LAT} AS approx_latitude,${SQL_APPROX_LNG} AS approx_longitude,p.created_at,${distanceExpr} AS distance_km,
      ${SQL_PHOTO_IDS} AS photo_ids,${isNewExpr} AS is_new,
      count(*) OVER()::integer AS total
    FROM public.publications p WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${limitParam} OFFSET ${offsetParam}`;

  const result = await database.query(sql, values);
  const total = result.rows[0]?.total ?? 0;
  const results = result.rows.map(row => ({
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
    distance_km: row.distance_km,
    created_at: row.created_at,
    photos: (row.photo_ids || []).map(id => ({ id, url: photoUrl(row.id, id) })),
    ...(newSince ? { is_new: Boolean(row.is_new) } : {}),
  }));
  return { results, page, page_size: pageSize, total, has_more: page * pageSize < total };
}
