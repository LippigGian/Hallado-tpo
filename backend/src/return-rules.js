// Punto 10: reglas de la devolución concretada. Módulo puro (sin base de datos).
import { holderId } from './meeting-point-rules.js';

// Plazo para valorar a la otra parte y para el agradecimiento público, desde la devolución.
export const FEEDBACK_DAYS = 7;

// Quien devuelve es quien tiene el objeto (punto 8): el publicador en "Es mío" y quien
// reclamó en "Lo encontré". Quien recupera es la otra parte del reclamo.
export function returnerId(claim) {
  return holderId(claim);
}

export function recovererId(claim) {
  return returnerId(claim) === claim.claimant_id ? claim.publisher_id : claim.claimant_id;
}

// Decide si `userId` puede confirmar la devolución del reclamo. `alreadyReturned` indica si el
// caso ya tiene una devolución registrada. Devuelve 'ok' o el motivo.
export function returnOutcome(claim, userId, alreadyReturned) {
  if (claim.claimant_id !== userId && claim.publisher_id !== userId) return 'not_found';
  if (alreadyReturned) return 'already_returned';
  if (claim.status !== 'accepted') return 'claim_not_accepted';
  if (recovererId(claim) !== userId) return 'not_recoverer';
  return 'ok';
}

// Vista de la devolución dentro del detalle del reclamo, según quién mira.
export function serializeReturn(claim, userId) {
  const returned = Boolean(claim.return_id);
  return {
    returned,
    returned_at: claim.returned_at ?? null,
    role: claim.claimant_id === userId || claim.publisher_id === userId
      ? (recovererId(claim) === userId ? 'recupera' : 'devuelve')
      : null,
    can_confirm: !returned && claim.status === 'accepted' && recovererId(claim) === userId,
  };
}
