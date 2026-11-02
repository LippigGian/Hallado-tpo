import { parseImage } from './image-validation.js';
import { CLAIM_RULES } from './claim-rules.js';
import { isMissing, textError } from './text-validation.js';

const ALLOWED_FIELDS = ['publication_id', 'verification_answer', 'description', 'found_neighborhood', 'photo'];
const INVALID_PHOTO = 'La foto debe ser un JPEG o PNG de hasta 2 MB.';

function descriptionError(description) {
  if (isMissing(description)) return '';
  if (typeof description !== 'string' || description.trim().length > CLAIM_RULES.descriptionMax) {
    return `La descripción puede tener hasta ${CLAIM_RULES.descriptionMax} caracteres.`;
  }
  return '';
}

function ownerClaimError(body, photo) {
  return textError(body.verification_answer, 'la respuesta de verificación', CLAIM_RULES.answer)
    || descriptionError(body.description)
    || (isMissing(body.found_neighborhood) ? '' : 'El barrio del hallazgo solo se pide al avisar que encontraste algo.')
    || (isMissing(body.photo) || photo ? '' : INVALID_PHOTO);
}

function finderClaimError(body, photo) {
  if (isMissing(body.photo)) return 'Adjuntá una foto del objeto que encontraste.';
  return (photo ? '' : INVALID_PHOTO)
    || textError(body.found_neighborhood, 'el barrio donde lo encontraste', CLAIM_RULES.neighborhood)
    || descriptionError(body.description)
    || (isMissing(body.verification_answer) ? '' : 'La respuesta de verificación solo se pide para objetos encontrados.');
}

export function validateClaim(body, kind) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Enviá los datos del reclamo.' };
  const unknownField = Object.keys(body).find(key => !ALLOWED_FIELDS.includes(key));
  if (unknownField) return { error: `Campo no permitido: ${unknownField}.` };

  const photo = isMissing(body.photo) ? null : parseImage(body.photo);
  const error = kind === 'owner' ? ownerClaimError(body, photo) : finderClaimError(body, photo);
  if (error) return { error };

  return {
    value: {
      kind,
      verification_answer: kind === 'owner' ? body.verification_answer.trim() : null,
      description: isMissing(body.description) ? '' : body.description.trim(),
      found_neighborhood: kind === 'finder' ? body.found_neighborhood.trim() : null,
      photo,
    },
  };
}
