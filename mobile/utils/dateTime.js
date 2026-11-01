// Fecha y hora como las escribe una persona: 31/10/2026 y 18:30 (hora local del teléfono).

const pad = number => String(number).padStart(2, '0');

export function formatDate(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// Mientras la persona escribe, agrega solas las barras: "31102026" -> "31/10/2026".
export function maskDate(text) {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// "1830" -> "18:30"
export function maskTime(text) {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

// Devuelve un Date, o null si el texto no es una fecha y hora reales (por ejemplo 31/02/2026 o 25:00).
export function parseDateTime(dateText, timeText) {
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText);
  const time = /^(\d{2}):(\d{2})$/.exec(timeText);
  if (!date || !time) return null;

  const [day, month, year, hours, minutes] = [...date.slice(1), ...time.slice(1)].map(Number);
  const result = new Date(year, month - 1, day, hours, minutes);
  // Si el día o el mes se "desbordaron", JavaScript cambia los valores: eso se rechaza.
  const isReal = result.getFullYear() === year && result.getMonth() === month - 1
    && result.getDate() === day && result.getHours() === hours && result.getMinutes() === minutes;
  return isReal ? result : null;
}
