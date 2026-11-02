import { readReputation } from './reputation.js';
import { canSeeExactLocation } from './publication-access.js';
import { photoUrl } from './publication-search.js';

// Devuelve el detalle de una publicación según quién la está mirando, o null si no existe.
export async function loadPublicationDetail(database, id, viewerId) {
  const result = await database.query(
    `SELECT p.id,p.type,p.title,p.description,p.category,p.neighborhood,
        to_char(p.occurred_on,'YYYY-MM-DD') AS occurred_on,p.time_slot,p.status,
        p.approx_latitude,p.approx_longitude,p.exact_address,p.latitude,p.longitude,
        p.created_at,p.updated_at,p.publisher_id,
        coalesce((SELECT array_agg(f.id::text ORDER BY f.position) FROM public.publication_photos f WHERE f.publication_id=p.id),'{}') AS photo_ids,
        (SELECT count(*)::integer FROM public.publication_follows f WHERE f.publication_id=p.id) AS followers_count,
        u.name AS publisher_name, u.neighborhood AS publisher_neighborhood, u.photo_mime AS publisher_photo_mime,
        u.profile_updated_at AS publisher_profile_updated_at, u.created_at AS publisher_created_at
      FROM public.publications p JOIN public.users u ON u.id=p.publisher_id WHERE p.id=$1`,
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
  const { thanks, ...reputation } = await readReputation(database, row.publisher_id);

  const isOwner = Boolean(viewerId) && viewerId === row.publisher_id;
  const notResolved = row.status !== 'resolved';

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    category: row.category,
    neighborhood: row.neighborhood,
    occurred_on: row.occurred_on,
    time_slot: row.time_slot,
    status: row.status,
    approx_latitude: row.approx_latitude,
    approx_longitude: row.approx_longitude,
    created_at: row.created_at,
    updated_at: row.updated_at,
    photos: (row.photo_ids || []).map(photoId => ({ id: photoId, url: photoUrl(row.id, photoId) })),
    followers_count: row.followers_count,
    publisher: {
      id: row.publisher_id,
      name: row.publisher_name,
      neighborhood: row.publisher_neighborhood,
      photo_url: row.publisher_photo_mime ? `/profiles/${row.publisher_id}/photo?v=${new Date(row.publisher_profile_updated_at).getTime()}` : null,
      created_at: row.publisher_created_at,
      reputation,
    },
    exact_location: canSeeExact ? { address: row.exact_address, latitude: row.latitude, longitude: row.longitude } : null,
    viewer: {
      authenticated: Boolean(viewerId),
      is_owner: isOwner,
      is_following: isFollowing,
      can_follow: Boolean(viewerId) && !isOwner && notResolved,
      can_claim: Boolean(viewerId) && !isOwner && notResolved,
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
  const pub = await database.query('SELECT publisher_id,status FROM public.publications WHERE id=$1', [publicationId]);
  if (!pub.rowCount) return { status: 404, body: { error: 'Publicación no encontrada.' } };
  if (pub.rows[0].publisher_id === userId) return { status: 400, body: { error: 'No hace falta seguir tu propia publicación.' } };
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
