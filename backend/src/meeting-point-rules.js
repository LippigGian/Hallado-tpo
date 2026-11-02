// Punto 8: reglas del acuerdo del punto de encuentro. Módulo puro (sin base de datos),
// con las mismas reglas que mobile/services/meetingPoint/meetingPointFlow.js.
export const ROLE_HOLDER = 'tiene_objeto';
export const ROLE_OTHER = 'otra_parte';

export const MEETING_LIMITS = { addressMin: 5, addressMax: 200, scheduleMax: 100, referenceMax: 200 };

// Quien tiene el objeto: en "Es mío" (owner) lo tiene quien publicó el hallazgo;
// en "Lo encontré" (finder) lo tiene quien reclamó.
export function holderId(claim) {
  return claim.kind === 'finder' ? claim.claimant_id : claim.publisher_id;
}

export function roleOf(claim, userId) {
  return holderId(claim) === userId ? ROLE_HOLDER : ROLE_OTHER;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateProposal(input) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const address = text(body.direccion);
  const schedule = text(body.horario);
  const reference = text(body.referencia);
  if (address.length < MEETING_LIMITS.addressMin || address.length > MEETING_LIMITS.addressMax) {
    return { error: `Ingresá una dirección o lugar (entre ${MEETING_LIMITS.addressMin} y ${MEETING_LIMITS.addressMax} caracteres).` };
  }
  if (!schedule || schedule.length > MEETING_LIMITS.scheduleMax) return { error: 'Indicá día y horario del encuentro.' };
  if (reference.length > MEETING_LIMITS.referenceMax) return { error: `La referencia admite hasta ${MEETING_LIMITS.referenceMax} caracteres.` };
  return { value: { address, schedule, reference } };
}

// Decide si `userId` puede proponer (o sugerir otro punto) / aceptar. Devuelve el motivo si no puede.
export function proposalOutcome(claim, proposals, userId) {
  if (claim.status !== 'accepted') return 'claim_not_accepted';
  if (proposals.some(p => p.accepted_at)) return 'already_agreed';
  const last = proposals.at(-1);
  if (!last) return holderId(claim) === userId ? 'ok' : 'not_holder';
  return last.proposed_by === userId ? 'own_turn' : 'ok';
}

export function acceptOutcome(claim, proposals, userId) {
  if (claim.status !== 'accepted') return 'claim_not_accepted';
  if (proposals.some(p => p.accepted_at)) return 'already_agreed';
  const last = proposals.at(-1);
  if (!last) return 'no_proposal';
  return last.proposed_by === userId ? 'own_proposal' : 'ok';
}

export function serializeAgreement(claim, proposals, viewerId) {
  const accepted = proposals.find(p => p.accepted_at) || null;
  const toView = p => ({
    id: p.id,
    direccion: p.address,
    horario: p.schedule,
    referencia: p.reference,
    propuestoPor: roleOf(claim, p.proposed_by),
    esMia: p.proposed_by === viewerId,
    propuestoEn: p.created_at,
    aceptadoEn: p.accepted_at || null,
  });
  return {
    estado: accepted ? 'aceptado' : proposals.length ? 'propuesto' : 'sin_propuesta',
    rol: roleOf(claim, viewerId),
    puedeProponer: proposalOutcome(claim, proposals, viewerId) === 'ok' && proposals.length === 0,
    puedeResponder: acceptOutcome(claim, proposals, viewerId) === 'ok',
    propuestas: proposals.map(toView),
    aceptado: accepted ? toView(accepted) : null,
  };
}
