import { publicationPhotoPath } from './publication-view.js';
import { serializeReturn } from './return-rules.js';
import { displayName } from './user-view.js';

export function serializeClaim(row, viewerId) {
  const isPublisher = row.publisher_id === viewerId;
  const accepted = row.status === 'accepted';
  const publication = {
    id: row.publication_id,
    type: row.publication_type,
    title: row.publication_title,
    category: row.publication_category,
    neighborhood: row.publication_neighborhood,
    cover_photo_url: row.cover_photo_id ? publicationPhotoPath(row.publication_id, row.cover_photo_id) : null,
    ...(accepted ? {
      address: row.publication_address,
      latitude: row.publication_latitude,
      longitude: row.publication_longitude,
    } : {}),
  };

  return {
    id: row.id,
    status: row.status,
    kind: row.kind,
    role: isPublisher ? 'publisher' : 'claimant',
    created_at: row.created_at,
    expires_at: row.expires_at,
    responded_at: row.responded_at,
    publication,
    claimant: { id: row.claimant_id, name: displayName(row.claimant_name) },
    publisher: { id: row.publisher_id, name: displayName(row.publisher_name) },
    verification_question: row.kind === 'owner' ? row.verification_question : null,
    verification_answer: row.verification_answer,
    description: row.description,
    found_neighborhood: row.found_neighborhood,
    photo_url: row.has_photo ? `/claims/${row.id}/photo` : null,
    ...(isPublisher && row.kind === 'owner' ? { expected_answer: row.expected_answer } : {}),
    // Punto 10: devolución concretada (la confirma quien recupera el objeto).
    return: serializeReturn(row, viewerId),
  };
}

export function isParticipant(row, userId) {
  return row.claimant_id === userId || row.publisher_id === userId;
}
