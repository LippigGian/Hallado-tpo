// Punto 10: historial de casos resueltos. Reglas puras (sin base de datos).
// La app ofrece períodos predeterminados; el backend los convierte en una fecha concreta de
// inicio, en la zona horaria de Argentina (la misma que usa el buscador).
import { CATEGORIES } from './publication-search.js';
import { todayInArgentina } from './alert-validation.js';
import { publicationPhotoPath } from './publication-view.js';
import { serializeRating } from './feedback-rules.js';

export const HISTORY_PERIODS = ['mes', '3meses', 'anio', 'todo'];
const DEFAULT_NAME = 'Vecino de Hallado';

// Resta meses a una fecha AAAA-MM-DD; si el día no existe en el mes destino (31 de marzo menos
// un mes), usa el último día de ese mes.
function minusMonths(date, months) {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

// Período -> primer día incluido (AAAA-MM-DD), o null para "todo".
export function periodStart(period, now = new Date()) {
  const today = todayInArgentina(now);
  if (period === 'mes') return minusMonths(today, 1);
  if (period === '3meses') return minusMonths(today, 3);
  if (period === 'anio') return `${today.slice(0, 4)}-01-01`;
  return null;
}

// Devuelve { error } o { value: { period, date_from, category } }.
export function parseHistoryQuery(query = {}, now = new Date()) {
  for (const key of Object.keys(query)) {
    if (Array.isArray(query[key])) return { error: 'Parámetros del historial inválidos.' };
  }
  let period = 'todo';
  if (query.period !== undefined && query.period !== '') {
    if (!HISTORY_PERIODS.includes(query.period)) return { error: 'Período inválido.' };
    period = query.period;
  }
  let category = null;
  if (query.category !== undefined && query.category !== '') {
    if (!CATEGORIES.includes(query.category)) return { error: 'Categoría inválida.' };
    category = query.category;
  }
  return { value: { period, date_from: periodStart(period, now), category } };
}

// Fila de la consulta -> caso del historial, visto por quien lo pide.
// role: 'returner' (pestaña Devolví) o 'recoverer' (pestaña Recuperé).
export function serializeHistoryItem(row, role) {
  const open = Boolean(row.feedback_open);
  return {
    id: row.id,
    claim_id: row.claim_id,
    returned_at: row.returned_at,
    publication: {
      id: row.publication_id,
      type: row.publication_type,
      title: row.publication_title,
      category: row.publication_category,
      cover_photo_url: row.cover_photo_id ? publicationPhotoPath(row.publication_id, row.cover_photo_id) : null,
    },
    counterpart: { id: row.counterpart_id, name: row.counterpart_name || DEFAULT_NAME },
    // Valoraciones y agradecimiento (hasta FEEDBACK_DAYS días después de la devolución).
    feedback: {
      until: row.feedback_until,
      open,
      given_rating: serializeRating(row.given_rating),
      received_rating: serializeRating(row.received_rating),
      thanks: row.thanks ? { message: row.thanks.message, created_at: row.thanks.created_at } : null,
      can_rate: open && !row.given_rating,
      can_thank: open && role === 'recoverer' && !row.thanks,
    },
  };
}
