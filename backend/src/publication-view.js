// Qué datos de una publicación ve cada persona. Es el único lugar donde se decide la privacidad:
// las rutas (y los módulos de buscador, detalle y reclamos) siempre pasan por acá.

export function publicationPhotoPath(publicationId, photoId) {
  return `/publications/${publicationId}/photos/${photoId}`;
}

// Coordenadas con 3 decimales (unos 100 m): sirven para ubicar la zona sin revelar la dirección exacta.
function approximate(value) {
  return value === null ? null : Math.round(value * 1000) / 1000;
}

/**
 * @param row      fila devuelta por publication-service
 * @param viewerId id del usuario que consulta
 * @param options.exactLocation  true si esa persona puede ver la dirección exacta además de quien publicó
 *                               (el punto 7 lo activa cuando el reclamo fue aceptado)
 */
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
    // La pregunta la ve quien quiera reclamar; la respuesta, solo quien publicó.
    verification_question: row.verification_question,
    ...(isOwner ? { verification_answer: row.verification_answer } : {}),
    status: row.status,
    expires_at: row.expires_at,
    created_at: row.created_at,
    photos: row.photo_ids.map(id => ({ id, url: publicationPhotoPath(row.id, id) })),
  };
}
