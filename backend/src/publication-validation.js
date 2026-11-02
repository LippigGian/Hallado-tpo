import { parseImage } from './image-validation.js';

export const PUBLICATION_TYPES = ['lost', 'found'];
export const CATEGORIES = ['documents', 'keys', 'electronics', 'pets', 'clothing', 'other'];

export const LIMITS = {
  title: [3, 80],
  description: [10, 1000],
  neighborhood: [1, 100],
  address: [3, 200],
  question: [5, 200],
  answer: [1, 100],
  maxPhotos: 5,
  maxPastDays: 365,
};

const ALLOWED_FIELDS = [
  'type', 'title', 'description', 'category', 'occurred_at', 'neighborhood', 'address',
  'latitude', 'longitude', 'verification_question', 'verification_answer', 'photos',
];
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function textError(value, label, [min, max]) {
  if (typeof value !== 'string') return `Completá ${label}.`;
  const length = value.trim().length;
  const sentence = label.charAt(0).toUpperCase() + label.slice(1);
  return length < min || length > max ? `${sentence} debe tener entre ${min} y ${max} caracteres.` : '';
}

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

function dateError(date, now) {
  if (Number.isNaN(date.getTime())) return 'Ingresá una fecha y hora válidas para el suceso.';
  if (date.getTime() > now.getTime() + CLOCK_TOLERANCE_MS) return 'La fecha del suceso no puede ser futura.';
  if (date.getTime() < now.getTime() - LIMITS.maxPastDays * DAY_MS) return 'La fecha del suceso no puede ser de hace más de un año.';
  return '';
}

function coordinatesError(latitude, longitude) {
  const hasLatitude = !isMissing(latitude);
  const hasLongitude = !isMissing(longitude);
  if (!hasLatitude && !hasLongitude) return '';
  if (!hasLatitude || !hasLongitude) return 'Las coordenadas deben incluir latitud y longitud.';
  const valid = Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  return valid ? '' : 'Las coordenadas no son válidas.';
}

function verificationError(body) {
  const hasQuestion = !isMissing(body.verification_question);
  const hasAnswer = !isMissing(body.verification_answer);
  if (body.type === 'lost') {
    return hasQuestion || hasAnswer ? 'Solo los objetos encontrados llevan pregunta de verificación.' : '';
  }
  return textError(body.verification_question, 'la pregunta de verificación', LIMITS.question)
    || textError(body.verification_answer, 'la respuesta de verificación', LIMITS.answer);
}

export function validatePublication(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Enviá los datos de la publicación.' };
  }
  const unknownField = Object.keys(body).find(key => !ALLOWED_FIELDS.includes(key));
  if (unknownField) return { error: `Campo no permitido: ${unknownField}.` };

  const occurredAt = new Date(body.occurred_at);
  const photos = Array.isArray(body.photos) ? body.photos.map(parseImage) : [];
  const invalidPhoto = photos.findIndex(photo => photo === null);

  const error =
    (PUBLICATION_TYPES.includes(body.type) ? '' : 'Elegí si perdiste o encontraste algo.')
    || textError(body.title, 'el título', LIMITS.title)
    || textError(body.description, 'la descripción', LIMITS.description)
    || (CATEGORIES.includes(body.category) ? '' : 'Elegí una categoría válida.')
    || (typeof body.occurred_at === 'string' ? dateError(occurredAt, now) : 'Ingresá la fecha y hora del suceso.')
    || textError(body.neighborhood, 'el barrio', LIMITS.neighborhood)
    || textError(body.address, 'la dirección', LIMITS.address)
    || coordinatesError(body.latitude, body.longitude)
    || verificationError(body)
    || (Array.isArray(body.photos) && body.photos.length >= 1 && body.photos.length <= LIMITS.maxPhotos
      ? '' : `Agregá entre 1 y ${LIMITS.maxPhotos} fotos.`)
    || (invalidPhoto === -1 ? '' : `La foto ${invalidPhoto + 1} debe ser un JPEG o PNG de hasta 2 MB.`);
  if (error) return { error };

  const isFound = body.type === 'found';
  return {
    value: {
      type: body.type,
      title: body.title.trim(),
      description: body.description.trim(),
      category: body.category,
      occurred_at: occurredAt,
      neighborhood: body.neighborhood.trim(),
      address: body.address.trim(),
      latitude: isMissing(body.latitude) ? null : body.latitude,
      longitude: isMissing(body.longitude) ? null : body.longitude,
      verification_question: isFound ? body.verification_question.trim() : null,
      verification_answer: isFound ? body.verification_answer.trim() : null,
      photos,
    },
  };
}
