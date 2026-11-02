import { hasAcceptedClaim } from './claim-service.js';

// Punto 4: la dirección exacta la ve quien publica.
// Punto 7: también la ve quien tiene un reclamo aceptado sobre la publicación.
export async function canSeeExactLocation(database, publication, viewerId) {
  if (!viewerId) return false;
  if (viewerId === publication.user_id) return true;
  return hasAcceptedClaim(database, publication.id, viewerId);
}
