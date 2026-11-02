import { readReputation } from './reputation.js';
import { canSeeExactLocation } from './publication-access.js';
import {
  photoUrl, SQL_APPROX_LAT, SQL_APPROX_LNG, SQL_OCCURRED_ON, SQL_PHOTO_IDS, SQL_STATUS, SQL_TIME_SLOT,
} from './publication-search.js';

// Devuelve el detalle de una publicación según quién la está mirando, o null si no existe.
// Lo usan el detalle (punto 4) y el inicio del reclamo (punto 7).
export async function loadPublicationDetail(database, id, viewerId) {
  const result = await database.query(
    `SELECT p.id,p.type,p.title,p.description,p.category,p.neighborhood,p.occurred_at,
        ${SQL_OCCURRED_ON} AS occurred_on,${SQL_TIME_SLOT} AS time_slot,${SQL_STATUS} AS status,
        ${SQL_APPROX_LAT} AS approx_latitude,${SQL_APPROX_LNG} AS approx_longitude,p.address,p.latitude,p.longitude,
        p.verification_question,p.verification_answer,p.expires_at,p.created_at,p.updated_at,p.user_id,
        ${SQL_PHOTO_IDS} AS photo_ids,
        (SELECT count(*)::integer FROM public.publication_follows f WHERE f.publication_id=p.id) AS followers_count,
        u.name AS publisher_name, u.neighborhood AS publisher_neighborhood, u.photo_mime AS publisher_photo_mime,
        u.profile_updated_at AS publisher_profile_updated_at, u.created_at AS publisher_created_at
      FROM public.publications p JOIN public.users u ON u.id=p.user_id WHERE p.id=$1`,
    [id],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];

  let isFollowing = false;
  if (viewerId) {
    const follow = await database.query('SELECT 1 FROM public.publication_follows WHERE publication_id=$1 AND user_id=$2', [id, viewerId]);
    isFollowing = Boolean(follow.rowCount);
  }

  const canSeeExact = await canSeeExactLocation(database, row, viewerId);
  const { thanks, ...reputation } = await readReputation(database, row.user_id);

  const isOwner = Boolean(viewerId) && viewerId === row.user_id;
  const active = row.status === 'open' || row.status === 'claimed';

  return {
    id: row.id,
    is_owner: isOwner,
    type: row.type,
    title: row.title,
    description: row.description,
    category: row.category,
    neighborhood: row.neighborhood,
    occurred_at: row.occurred_at,
    occurred_on: row.occurred_on,
    time_slot: row.time_slot,
    status: row.status,
    expires_at: row.expires_at,
    approx_latitude: row.approx_latitude,
    approx_longitude: row.approx_longitude,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // La pregunta es pública (la responde quien reclama); la respuesta solo la ve quien publica.
    verification_question: row.verification_question,
    ...(isOwner ? { verification_answer: row.verification_answer } : {}),
    photos: (row.photo_ids || []).map(photoId => ({ id: photoId, url: photoUrl(row.id, photoId) })),
    followers_count: row.followers_count,
    publisher: {
      id: row.user_id,
      name: row.publisher_name,
      neighborhood: row.publisher_neighborhood,
      photo_url: row.publisher_photo_mime ? `/profiles/${row.user_id}/photo?v=${new Date(row.publisher_profile_updated_at).getTime()}` : null,
      created_at: row.publisher_created_at,
      reputation,
    },
    // `address` lo usa el reclamo (punto 7) y `exact_location` la pantalla de detalle (punto 4).
    address: canSeeExact ? row.address : null,
    exact_location: canSeeExact ? { address: row.address, latitude: row.latitude, longitude: row.longitude } : null,
    viewer: {
      authenticated: Boolean(viewerId),
      is_owner: isOwner,
      is_following: isFollowing,
      can_follow: Boolean(viewerId) && !isOwner && active,
      can_claim: Boolean(viewerId) && !isOwner && active,
      claim_action: row.type === 'found' ? 'its_mine' : 'i_found_it',
      can_manage: isOwner,
    },
  };
}

async function followersCount(database, publicationId) {
  const result = await database.query('SELECT count(*)::integer AS c FROM public.publication_follows WHERE publication_id=$1', [publicationId]);
  return result.rows[0].c;
}

export async function followPublication(database, publicationId, userId) {
  const pub = await database.query('SELECT user_id,status FROM public.publications WHERE id=$1', [publicationId]);
  if (!pub.rowCount) return { status: 404, body: { error: 'Publicación no encontrada.' } };
  if (pub.rows[0].user_id === userId) return { status: 400, body: { error: 'No hace falta seguir tu propia publicación.' } };
  if (pub.rows[0].status === 'resolved') return { status: 409, body: { error: 'La publicación ya está resuelta.' } };
  await database.query('INSERT INTO public.publication_follows(publication_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [publicationId, userId]);
  return { status: 200, body: { following: true, followers_count: await followersCount(database, publicationId) } };
}

export async function unfollowPublication(database, publicationId, userId) {
  const pub = await database.query('SELECT 1 FROM public.publications WHERE id=$1', [publicationId]);
  if (!pub.rowCount) return { status: 404, body: { error: 'Publicación no encontrada.' } };
  await database.query('DELETE FROM public.publication_follows WHERE publication_id=$1 AND user_id=$2', [publicationId, userId]);
  return { status: 200, body: { following: false, followers_count: await followersCount(database, publicationId) } };
}
