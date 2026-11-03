// Punto 10 - Historial: funciones puras (sin imports) para textos y validaciones de la pantalla
// de Historial y del formulario de valoración/agradecimiento. Se prueban en scripts/history.test.mjs.

export const PERIODOS_HISTORIAL = [
  { value: 'mes', label: 'Último mes' },
  { value: '3meses', label: 'Últimos 3 meses' },
  { value: 'anio', label: 'Este año' },
  { value: 'todo', label: 'Todo' },
];

export const PESTANIAS_HISTORIAL = [
  { value: 'returned', label: 'Devolví' },
  { value: 'recovered', label: 'Recuperé' },
];

export const MENSAJE_MAXIMO = 200;

const dos = n => String(n).padStart(2, '0');
const fecha = valor => {
  const d = new Date(valor);
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// "Devolviste a Ana el 01/11/2026" / "Ana te lo devolvió el 01/11/2026".
export function textoCaso(caso, pestania) {
  const nombre = caso.counterpart.name;
  return pestania === 'returned'
    ? `Devolviste a ${nombre} el ${fecha(caso.returned_at)}`
    : `${nombre} te lo devolvió el ${fecha(caso.returned_at)}`;
}

export function textoValoracion(valoracion) {
  if (!valoracion) return '';
  const tipo = valoracion.value === 'positive' ? 'Positiva' : 'Negativa';
  return valoracion.message ? `${tipo}: “${valoracion.message}”` : tipo;
}

// Plazo para valorar o agradecer, o '' si ya no queda nada por hacer.
export function textoPlazo(caso) {
  const fb = caso.feedback;
  if (!fb.can_rate && !fb.can_thank) return '';
  return `Podés hacerlo hasta el ${fecha(fb.until)}.`;
}

function limpiar(texto) {
  return typeof texto === 'string' ? texto.trim().replace(/\s+/g, ' ') : '';
}

// { error } o { value } listo para POST /history/:id/rating.
export function validarValoracion({ valor, mensaje }) {
  if (valor !== 'positive' && valor !== 'negative') return { error: 'Elegí si tu valoración es positiva o negativa.' };
  const texto = limpiar(mensaje);
  if (texto.length > MENSAJE_MAXIMO) return { error: `El mensaje admite hasta ${MENSAJE_MAXIMO} caracteres.` };
  return { value: texto ? { value: valor, message: texto } : { value: valor } };
}

// { error } o { value } listo para POST /history/:id/thanks.
export function validarAgradecimiento({ mensaje }) {
  const texto = limpiar(mensaje);
  if (!texto) return { error: 'Escribí tu agradecimiento.' };
  if (texto.length > MENSAJE_MAXIMO) return { error: `El mensaje admite hasta ${MENSAJE_MAXIMO} caracteres.` };
  return { value: { message: texto } };
}
