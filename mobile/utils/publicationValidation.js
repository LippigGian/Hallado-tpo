import { CATEGORIES, LIMITS } from '../config/publicationOptions.js';
import { formatDate, formatTime, parseDateTime } from './dateTime.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function emptyForm(now = new Date()) {
  return {
    type: '',
    photos: [], // URIs locales de las fotos
    title: '',
    description: '',
    category: '',
    date: formatDate(now),
    time: formatTime(now),
    neighborhood: '',
    address: '',
    latitude: null,
    longitude: null,
    verification_question: '',
    verification_answer: '',
  };
}

function lengthError(value, label, [min, max]) {
  const length = value.trim().length;
  return length < min || length > max ? `${label} debe tener entre ${min} y ${max} caracteres.` : '';
}

function occurredAtError(form, now) {
  const occurredAt = parseDateTime(form.date, form.time);
  if (!occurredAt) return 'Ingresá una fecha (DD/MM/AAAA) y una hora (HH:MM) válidas.';
  if (occurredAt > now) return 'La fecha del suceso no puede ser futura.';
  if (now - occurredAt > LIMITS.maxPastDays * DAY_MS) return 'La fecha del suceso no puede ser de hace más de un año.';
  return '';
}

// Cada validador devuelve el mensaje del primer problema, o '' si el paso está completo.
const stepValidators = {
  type: form => (form.type ? '' : 'Elegí si perdiste o encontraste algo.'),

  photos: form => (form.photos.length >= 1 && form.photos.length <= LIMITS.maxPhotos
    ? '' : `Agregá entre 1 y ${LIMITS.maxPhotos} fotos.`),

  details: (form, now) => lengthError(form.title, 'El título', LIMITS.title)
    || lengthError(form.description, 'La descripción', LIMITS.description)
    || (CATEGORIES.some(category => category.value === form.category) ? '' : 'Elegí una categoría.')
    || occurredAtError(form, now),

  location: form => lengthError(form.neighborhood, 'El barrio', LIMITS.neighborhood)
    || lengthError(form.address, 'La dirección', LIMITS.address),

  verification: form => lengthError(form.verification_question, 'La pregunta de verificación', LIMITS.question)
    || lengthError(form.verification_answer, 'La respuesta', LIMITS.answer),
};

export function validateStep(stepId, form, now = new Date()) {
  return stepValidators[stepId](form, now);
}

// Arma el cuerpo que espera POST /publications. Las fotos siguen siendo URIs: el servicio las convierte al enviar.
export function buildPayload(form) {
  const payload = {
    type: form.type,
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category,
    occurred_at: parseDateTime(form.date, form.time).toISOString(),
    neighborhood: form.neighborhood.trim(),
    address: form.address.trim(),
    photos: form.photos,
  };
  if (form.latitude !== null && form.longitude !== null) {
    payload.latitude = form.latitude;
    payload.longitude = form.longitude;
  }
  if (form.type === 'found') {
    payload.verification_question = form.verification_question.trim();
    payload.verification_answer = form.verification_answer.trim();
  }
  return payload;
}
