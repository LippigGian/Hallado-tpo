// Punto 3 - Buscador inicial y resultados.
// Módulo puro (sin imports): arma y valida los criterios de búsqueda, y administra la
// lista de últimas búsquedas / alertas guardadas en el dispositivo. Se puede testear con
// `node --test` cargándolo como data: URL (ver mobile/scripts/search-criteria.test.mjs).

export const CATEGORIAS = [
  { id: 'documents', etiqueta: 'Documentos' },
  { id: 'keys', etiqueta: 'Llaves' },
  { id: 'electronics', etiqueta: 'Electrónica' },
  { id: 'pets', etiqueta: 'Mascotas' },
  { id: 'clothing', etiqueta: 'Ropa' },
  { id: 'other', etiqueta: 'Otros' },
];

export const SITUACIONES = [
  { id: 'perdi', etiqueta: 'Perdí algo' },
  { id: 'encontre', etiqueta: 'Encontré algo' },
];

export const CUANDO = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: '3dias', etiqueta: 'Últimos 3 días' },
  { id: 'semana', etiqueta: 'Última semana' },
  { id: 'rango', etiqueta: 'Elegir fechas' },
];

export const FRANJAS = [
  { id: 'early_morning', etiqueta: 'Madrugada' },
  { id: 'morning', etiqueta: 'Mañana' },
  { id: 'afternoon', etiqueta: 'Tarde' },
  { id: 'night', etiqueta: 'Noche' },
];

export const ESTADOS = [
  { id: 'open', etiqueta: 'Abierta' },
  { id: 'in_claim', etiqueta: 'En reclamo' },
  { id: 'resolved', etiqueta: 'Resuelta' },
];

function restarDias(fecha, dias) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() - dias);
}

export function fechaLocalISO(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

// 'DD/MM/AAAA' -> 'AAAA-MM-DD', o null si el texto no es una fecha de calendario válida.
export function parsearFecha(texto) {
  if (typeof texto !== 'string') return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!match) return null;
  const dia = Number(match[1]), mes = Number(match[2]), anio = Number(match[3]);
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null;
  return fechaLocalISO(fecha);
}

export function formatearFecha(iso) {
  if (typeof iso !== 'string') return '';
  const [anio, mes, dia] = iso.split('-');
  if (!anio || !mes || !dia) return '';
  return `${dia}/${mes}/${anio}`;
}

export function rangoDeFechas(criterios = {}, ahora = new Date()) {
  const hoy = fechaLocalISO(ahora);
  if (criterios.cuando === 'hoy') return { from: hoy, to: hoy };
  if (criterios.cuando === '3dias') return { from: fechaLocalISO(restarDias(ahora, 2)), to: hoy };
  if (criterios.cuando === 'semana') return { from: fechaLocalISO(restarDias(ahora, 6)), to: hoy };
  if (criterios.cuando === 'rango') return { from: parsearFecha(criterios.desde), to: parsearFecha(criterios.hasta) };
  return { from: null, to: null };
}

export function validarCriterios(criterios = {}, ahora = new Date()) {
  const errores = {};
  if (criterios.queTePaso !== 'perdi' && criterios.queTePaso !== 'encontre') errores.queTePaso = 'Elegí si perdiste o encontraste algo.';
  if (!criterios.categoria) errores.categoria = 'Elegí qué es.';
  if ((criterios.origenUbicacion === 'lista' || criterios.origenUbicacion === 'dispositivo') && !criterios.barrio) {
    errores.barrio = 'Elegí un barrio o usá tu ubicación.';
  }
  if (!['hoy', '3dias', 'semana', 'rango'].includes(criterios.cuando)) {
    errores.cuando = 'Elegí cuándo pasó.';
  } else if (criterios.cuando === 'rango') {
    const desde = parsearFecha(criterios.desde);
    const hasta = parsearFecha(criterios.hasta);
    if (!desde || !hasta) errores.cuando = 'Usá el formato DD/MM/AAAA.';
    else {
      const hoy = fechaLocalISO(ahora);
      if (desde > hasta) errores.cuando = 'La fecha inicial no puede ser posterior a la final.';
      else if (desde > hoy || hasta > hoy) errores.cuando = 'La fecha no puede ser futura.';
    }
  }
  if (criterios.palabras && criterios.palabras.length > 100) errores.palabras = 'Las palabras clave admiten hasta 100 caracteres.';
  return errores;
}

export function criteriosAParams(criterios = {}, { pagina = 1, ahora = new Date(), referencia = null } = {}) {
  const { from, to } = rangoDeFechas(criterios, ahora);
  const cercanos = criterios.orden === 'cercanos';
  const params = {
    situation: criterios.queTePaso === 'perdi' ? 'lost' : criterios.queTePaso === 'encontre' ? 'found' : undefined,
    category: criterios.categoria || undefined,
    q: criterios.palabras || undefined,
    neighborhood: criterios.origenUbicacion === 'todos' ? undefined : (criterios.barrio || undefined),
    from: from || undefined,
    to: to || undefined,
    sort: cercanos ? 'nearest' : undefined,
    lat: cercanos && referencia ? referencia.lat : undefined,
    lng: cercanos && referencia ? referencia.lng : undefined,
    page: pagina,
    page_size: 10,
  };
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

// Misma clave que mobile/services/offline/offlineCache.js (claveDeBusqueda), duplicada
// porque ese módulo importa expo-file-system y no se puede cargar en un test puro.
export function claveCriterios(criterios = {}) {
  const ordenados = Object.keys(criterios)
    .filter(k => criterios[k] !== undefined && criterios[k] !== null && criterios[k] !== '')
    .sort()
    .reduce((acc, k) => ({ ...acc, [k]: criterios[k] }), {});
  return JSON.stringify(ordenados);
}

export function describirBusqueda(criterios = {}) {
  const partes = [];
  if (criterios.queTePaso) partes.push(SITUACIONES.find(s => s.id === criterios.queTePaso)?.etiqueta.replace(' algo', '') || criterios.queTePaso);
  const categoria = CATEGORIAS.find(c => c.id === criterios.categoria);
  if (categoria) partes.push(categoria.etiqueta);
  if (criterios.palabras) partes.push(`"${criterios.palabras}"`);
  if (criterios.barrio) partes.push(criterios.barrio);
  const cuando = CUANDO.find(c => c.id === criterios.cuando);
  if (cuando) partes.push(cuando.id === 'rango' && criterios.desde && criterios.hasta ? `${criterios.desde} - ${criterios.hasta}` : cuando.etiqueta);
  return partes.join(' · ');
}

const TOPE_ALERTAS = 10;
const TOPE_RECIENTES = 5;

// lista: [{ clave, criterios, usadaEn, guardada, guardadaEn? }]
export function agregarReciente(lista = [], criterios, ahora = new Date()) {
  const clave = claveCriterios(criterios);
  const previo = lista.find(item => item.clave === clave);
  const registro = {
    clave,
    criterios,
    usadaEn: ahora.getTime(),
    guardada: Boolean(previo?.guardada),
    ...(previo?.guardada ? { guardadaEn: previo.guardadaEn } : {}),
  };
  const combinada = [registro, ...lista.filter(item => item.clave !== clave)];
  const guardadas = combinada.filter(item => item.guardada).slice(0, TOPE_ALERTAS);
  const recientes = combinada.filter(item => !item.guardada).slice(0, TOPE_RECIENTES);
  const permitidas = new Set([...guardadas, ...recientes]);
  return combinada.filter(item => permitidas.has(item));
}

export function marcarComoAlerta(lista = [], criterios, ahora = new Date()) {
  const clave = claveCriterios(criterios);
  const previo = lista.find(item => item.clave === clave);
  const registro = { clave, criterios, usadaEn: previo?.usadaEn ?? ahora.getTime(), guardada: true, guardadaEn: ahora.getTime() };
  return [registro, ...lista.filter(item => item.clave !== clave)];
}

export function quitarAlerta(lista = [], clave) {
  return lista.filter(item => item.clave !== clave);
}

export function recientes(lista = []) {
  return lista.filter(item => !item.guardada).sort((a, b) => b.usadaEn - a.usadaEn);
}

export function alertas(lista = []) {
  return lista.filter(item => item.guardada).sort((a, b) => (b.guardadaEn ?? 0) - (a.guardadaEn ?? 0));
}
