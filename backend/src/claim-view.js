import { publicationPhotoPath } from './publication-view.js';

const DEFAULT_NAME = 'Vecino de Hallado';

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
    claimant: { id: row.claimant_id, name: row.claimant_name || DEFAULT_NAME },
    publisher: { id: row.publisher_id, name: row.publisher_name || DEFAULT_NAME },
    verification_question: row.kind === 'owner' ? row.verification_question : null,
    verification_answer: row.verification_answer,
    description: row.description,
    found_neighborhood: row.found_neighborhood,
    photo_url: row.has_photo ? `/claims/${row.id}/photo` : null,
    ...(isPublisher && row.kind === 'owner' ? { expected_answer: row.expected_answer } : {}),
  };
}

export function isParticipant(row, userId) {
  return row.claimant_id === userId || row.publisher_id === userId;
}
