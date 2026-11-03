// Punto 9: validación de una alerta de búsqueda (POST /alerts).
// Los criterios son los del buscador del punto 3, pero la fecha llega siempre como rango
// concreto (date_from/date_to): la app convierte "Hoy", "Últimos 3 días" o "Última semana" en
// fechas al guardar. `date_preset` indica qué opción eligió la persona, solo para mostrarla.
import { CATEGORIES } from './publication-validation.js';
import { todayInArgentina, validDate } from './dates.js';

export const MAX_ALERTS_PER_USER = 10;
export const DATE_PRESETS = ['hoy', '3dias', 'semana', 'rango'];

function optionalText(value, max, message) {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== 'string') return { error: message };
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) return { value: null };
  if (text.length > max) return { error: message };
  return { value: text };
}

// Devuelve { error } o { value } con los criterios normalizados, listos para guardar.
export function validateAlert(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Datos de la alerta inválidos.' };

  if (body.situation !== 'lost' && body.situation !== 'found') return { error: 'Indicá si perdiste o encontraste algo.' };

  let category = null;
  if (body.category !== undefined && body.category !== null && body.category !== '') {
    if (!CATEGORIES.includes(body.category)) return { error: 'Categoría inválida.' };
    category = body.category;
  }

  const neighborhood = optionalText(body.neighborhood, 100, 'Barrio o localidad inválido.');
  if (neighborhood.error) return { error: neighborhood.error };
  const keywords = optionalText(body.keywords, 100, 'Las palabras clave admiten hasta 100 caracteres.');
  if (keywords.error) return { error: keywords.error };

  const hasPreset = body.date_preset !== undefined && body.date_preset !== null && body.date_preset !== '';
  const hasFrom = body.date_from !== undefined && body.date_from !== null && body.date_from !== '';
  const hasTo = body.date_to !== undefined && body.date_to !== null && body.date_to !== '';
  let datePreset = null, dateFrom = null, dateTo = null;
  if (hasPreset || hasFrom || hasTo) {
    if (!hasPreset || !DATE_PRESETS.includes(body.date_preset)) return { error: 'Indicá cuándo pasó.' };
    if (!validDate(body.date_from) || !validDate(body.date_to)) return { error: 'Revisá el rango de fechas (formato AAAA-MM-DD).' };
    if (body.date_from > body.date_to) return { error: 'La fecha inicial no puede ser posterior a la final.' };
    if (body.date_to > todayInArgentina(now)) return { error: 'La fecha no puede ser futura.' };
    datePreset = body.date_preset;
    dateFrom = body.date_from;
    dateTo = body.date_to;
  }

  return {
    value: {
      situation: body.situation,
      category,
      neighborhood: neighborhood.value,
      keywords: keywords.value,
      date_preset: datePreset,
      date_from: dateFrom,
      date_to: dateTo,
    },
  };
}

// PATCH /alerts/:id: por ahora solo se puede pausar o reanudar.
export function validateAlertUpdate(body) {
  if (!body || typeof body !== 'object' || typeof body.paused !== 'boolean') return { error: 'Indicá si la alerta queda pausada.' };
  return { value: { paused: body.paused } };
}
