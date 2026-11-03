// Fechas compartidas por el buscador (punto 3), las alertas (punto 9) y el historial (punto 10).
// La app trabaja con la hora de Argentina: "hoy", los filtros por fecha y los períodos se
// calculan en esa zona, no en la del servidor.
export const ZONE_AR = 'America/Argentina/Buenos_Aires';
// La misma zona como literal SQL, para `timestamptz AT TIME ZONE ${SQL_ZONE_AR}`.
export const SQL_ZONE_AR = `'${ZONE_AR}'`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fecha AAAA-MM-DD que existe en el calendario (rechaza 2026-02-30).
export function validDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Fecha de hoy en Argentina (AAAA-MM-DD).
export function todayInArgentina(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE_AR, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
