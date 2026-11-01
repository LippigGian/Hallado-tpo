// Punto 8 - Reglas del acuerdo del punto de encuentro, sin dependencias de React Native.
// 1. Una vez aceptado el reclamo, quien tiene el objeto propone el punto de encuentro.
// 2. La otra parte lo acepta o sugiere uno alternativo.
// 3. Ante una alternativa, quien propuso primero acepta o vuelve a sugerir, y así
//    hasta que una de las partes acepta la última propuesta de la otra.

export const ROL_TIENE_OBJETO = 'tiene_objeto';
export const ROL_OTRA_PARTE = 'otra_parte';
export const ESTADO_SIN_PROPUESTA = 'sin_propuesta';
export const ESTADO_PROPUESTO = 'propuesto';
export const ESTADO_ACEPTADO = 'aceptado';

export function nuevoAcuerdo() {
  return { estado: ESTADO_SIN_PROPUESTA, propuestas: [] };
}

export function propuestaActual(acuerdo) {
  return acuerdo.propuestas[acuerdo.propuestas.length - 1] || null;
}

export function validarPropuesta({ direccion, horario }) {
  const errores = {};
  if (!direccion || direccion.trim().length < 5) errores.direccion = 'Ingresá una dirección o lugar (mínimo 5 caracteres).';
  if (!horario || !horario.trim()) errores.horario = 'Indicá día y horario del encuentro.';
  return errores;
}

export function puedeProponer(acuerdo, rol) {
  return acuerdo.estado === ESTADO_SIN_PROPUESTA && rol === ROL_TIENE_OBJETO;
}

/** Puede aceptar o sugerir alternativa quien NO hizo la última propuesta. */
export function puedeResponder(acuerdo, rol) {
  const actual = propuestaActual(acuerdo);
  return acuerdo.estado === ESTADO_PROPUESTO && Boolean(actual) && actual.propuestoPor !== rol;
}

function agregarPropuesta(acuerdo, rol, datos) {
  const errores = validarPropuesta(datos);
  if (Object.keys(errores).length) {
    const error = new Error('La propuesta tiene datos inválidos.');
    error.errores = errores;
    throw error;
  }
  const propuesta = {
    direccion: datos.direccion.trim(),
    horario: datos.horario.trim(),
    referencia: (datos.referencia || '').trim(),
    latitud: Number.isFinite(datos.latitud) ? datos.latitud : null,
    longitud: Number.isFinite(datos.longitud) ? datos.longitud : null,
    propuestoPor: rol,
    propuestoEn: Date.now(),
  };
  return { estado: ESTADO_PROPUESTO, propuestas: [...acuerdo.propuestas, propuesta] };
}

export function proponer(acuerdo, rol, datos) {
  if (!puedeProponer(acuerdo, rol)) throw new Error('Solo quien tiene el objeto propone el primer punto de encuentro.');
  return agregarPropuesta(acuerdo, rol, datos);
}

export function sugerirAlternativa(acuerdo, rol, datos) {
  if (!puedeResponder(acuerdo, rol)) throw new Error('No podés sugerir otro punto en este momento.');
  return agregarPropuesta(acuerdo, rol, datos);
}

export function aceptar(acuerdo, rol) {
  if (!puedeResponder(acuerdo, rol)) throw new Error('No podés aceptar tu propia propuesta.');
  return { ...acuerdo, estado: ESTADO_ACEPTADO, aceptadoPor: rol, aceptadoEn: Date.now() };
}
