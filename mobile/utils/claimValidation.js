import { CLAIM_LIMITS } from '../config/claimOptions.js';

export function emptyClaimForm() {
  return { verification_answer: '', description: '', found_neighborhood: '', photos: [] };
}

function lengthError(value, label, [min, max]) {
  const length = value.trim().length;
  return length < min || length > max ? `${label} debe tener entre ${min} y ${max} caracteres.` : '';
}

function descriptionError(form) {
  return form.description.trim().length > CLAIM_LIMITS.descriptionMax
    ? `La descripción puede tener hasta ${CLAIM_LIMITS.descriptionMax} caracteres.`
    : '';
}

const kindValidators = {
  owner: form => lengthError(form.verification_answer, 'La respuesta', CLAIM_LIMITS.answer)
    || descriptionError(form),

  finder: form => (form.photos.length === 1 ? '' : 'Adjuntá una foto del objeto que encontraste.')
    || lengthError(form.found_neighborhood, 'El barrio', CLAIM_LIMITS.neighborhood)
    || descriptionError(form),
};

export function validateClaimForm(kind, form) {
  return kindValidators[kind](form);
}

export function buildClaimPayload(publicationId, kind, form) {
  const payload = { publication_id: publicationId };
  const description = form.description.trim();
  if (description) payload.description = description;
  if (form.photos.length) payload.photo = form.photos[0];
  if (kind === 'owner') payload.verification_answer = form.verification_answer.trim();
  else payload.found_neighborhood = form.found_neighborhood.trim();
  return payload;
}
