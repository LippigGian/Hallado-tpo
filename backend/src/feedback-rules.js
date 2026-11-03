// Punto 10: valoraciones y agradecimientos de un caso resuelto. Reglas puras (sin base de datos).
// - Valoración: cada parte valora a la otra (positiva o negativa) una sola vez, sin editar.
// - Agradecimiento: solo quien recuperó, a quien devolvió; es público en su perfil.
// - Ambos dentro de los FEEDBACK_DAYS días posteriores a la devolución.

// Plazo para valorar a la otra parte y para el agradecimiento público, desde la devolución.
export const FEEDBACK_DAYS = 7;
export const FEEDBACK_MESSAGE_MAX = 200;
const RATING_VALUES = { positive: 1, negative: -1 };

function cleanMessage(value) {
  if (value === undefined || value === null) return { value: '' };
  if (typeof value !== 'string') return { error: 'Mensaje inválido.' };
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length > FEEDBACK_MESSAGE_MAX) return { error: `El mensaje admite hasta ${FEEDBACK_MESSAGE_MAX} caracteres.` };
  return { value: text };
}

// Devuelve { error } o { value: { value: 1|-1, message } }.
export function validateRating(body) {
  if (!body || typeof body !== 'object' || !Object.hasOwn(RATING_VALUES, body.value)) {
    return { error: 'Indicá si la valoración es positiva o negativa.' };
  }
  const message = cleanMessage(body.message);
  if (message.error) return { error: message.error };
  return { value: { value: RATING_VALUES[body.value], message: message.value } };
}

// Devuelve { error } o { value: { message } }. El agradecimiento necesita texto.
export function validateThanks(body) {
  const message = cleanMessage(body && typeof body === 'object' ? body.message : undefined);
  if (message.error) return { error: message.error };
  if (!message.value) return { error: 'Escribí tu agradecimiento.' };
  return { value: { message: message.value } };
}

// ret: fila de returns con feedback_open. kind: 'rating' | 'thanks'.
// outcome: 'ok' | 'not_found' | 'not_recoverer' | 'window_closed'.
export function feedbackOutcome(ret, userId, kind) {
  if (!ret || (ret.returner_id !== userId && ret.recoverer_id !== userId)) return 'not_found';
  if (kind === 'thanks' && ret.recoverer_id !== userId) return 'not_recoverer';
  if (!ret.feedback_open) return 'window_closed';
  return 'ok';
}

// A quién va dirigida la valoración o el agradecimiento: siempre la otra parte.
export function feedbackTarget(ret, userId) {
  return ret.returner_id === userId ? ret.recoverer_id : ret.returner_id;
}

export function serializeRating(event) {
  if (!event) return null;
  return { value: event.value === 1 ? 'positive' : 'negative', message: event.message, created_at: event.created_at };
}
