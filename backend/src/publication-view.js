export function publicationPhotoPath(publicationId, photoId) {
  return `/publications/${publicationId}/photos/${photoId}`;
}

function approximate(value) {
  return value === null ? null : Math.round(value * 1000) / 1000;
}

export function serializePublication(row, viewerId, { exactLocation = false } = {}) {
  const isOwner = row.user_id === viewerId;
  const showExactLocation = isOwner || exactLocation;

  return {
    id: row.id,
    user_id: row.user_id,
    is_owner: isOwner,
    type: row.type,
    title: row.title,
    description: row.description,
    category: row.category,
    occurred_at: row.occurred_at,
    neighborhood: row.neighborhood,
    address: showExactLocation ? row.address : null,
    latitude: showExactLocation ? row.latitude : approximate(row.latitude),
    longitude: showExactLocation ? row.longitude : approximate(row.longitude),
    verification_question: row.verification_question,
    ...(isOwner ? { verification_answer: row.verification_answer } : {}),
    status: row.status,
    expires_at: row.expires_at,
    created_at: row.created_at,
    photos: row.photo_ids.map(id => ({ id, url: publicationPhotoPath(row.id, id) })),
  };
}
