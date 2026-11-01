// Punto 3 - Buscador inicial y resultados.
// Módulo puro (sin imports): barrios de CABA y localidades del AMBA con centroides
// aproximados, para elegir "¿Dónde?" de una lista o resolver la ubicación actual del
// dispositivo al barrio más cercano. Los mismos centroides se usan en el seed del backend
// (backend/scripts/seed-publications.js), duplicados porque ese script no puede importar
// un módulo que a su vez importa expo-file-system.
export const BARRIOS = [
  { nombre: 'Agronomía', lat: -34.5925, lng: -58.4875 },
  { nombre: 'Almagro', lat: -34.6097, lng: -58.4208 },
  { nombre: 'Balvanera', lat: -34.6089, lng: -58.4039 },
  { nombre: 'Barracas', lat: -34.6389, lng: -58.3833 },
  { nombre: 'Belgrano', lat: -34.5622, lng: -58.4583 },
  { nombre: 'Boedo', lat: -34.6297, lng: -58.4183 },
  { nombre: 'Caballito', lat: -34.6186, lng: -58.4397 },
  { nombre: 'Chacarita', lat: -34.5875, lng: -58.4531 },
  { nombre: 'Coghlan', lat: -34.5611, lng: -58.4667 },
  { nombre: 'Colegiales', lat: -34.5756, lng: -58.4494 },
  { nombre: 'Constitución', lat: -34.6256, lng: -58.3814 },
  { nombre: 'Flores', lat: -34.6286, lng: -58.4644 },
  { nombre: 'Floresta', lat: -34.6297, lng: -58.4836 },
  { nombre: 'La Boca', lat: -34.6345, lng: -58.3631 },
  { nombre: 'La Paternal', lat: -34.5953, lng: -58.4725 },
  { nombre: 'Liniers', lat: -34.6422, lng: -58.5231 },
  { nombre: 'Mataderos', lat: -34.6597, lng: -58.5100 },
  { nombre: 'Monte Castro', lat: -34.6186, lng: -58.5086 },
  { nombre: 'Montserrat', lat: -34.6117, lng: -58.3789 },
  { nombre: 'Nueva Pompeya', lat: -34.6494, lng: -58.4186 },
  { nombre: 'Núñez', lat: -34.5450, lng: -58.4600 },
  { nombre: 'Palermo', lat: -34.5780, lng: -58.4265 },
  { nombre: 'Parque Avellaneda', lat: -34.6428, lng: -58.4706 },
  { nombre: 'Parque Chacabuco', lat: -34.6336, lng: -58.4383 },
  { nombre: 'Parque Chas', lat: -34.5847, lng: -58.4761 },
  { nombre: 'Parque Patricios', lat: -34.6364, lng: -58.4019 },
  { nombre: 'Puerto Madero', lat: -34.6089, lng: -58.3631 },
  { nombre: 'Recoleta', lat: -34.5875, lng: -58.3974 },
  { nombre: 'Retiro', lat: -34.5925, lng: -58.3747 },
  { nombre: 'Saavedra', lat: -34.5558, lng: -58.4867 },
  { nombre: 'San Cristóbal', lat: -34.6225, lng: -58.4011 },
  { nombre: 'San Nicolás', lat: -34.6033, lng: -58.3817 },
  { nombre: 'San Telmo', lat: -34.6211, lng: -58.3731 },
  { nombre: 'Vélez Sarsfield', lat: -34.6314, lng: -58.4931 },
  { nombre: 'Versalles', lat: -34.6264, lng: -58.5278 },
  { nombre: 'Villa Crespo', lat: -34.5992, lng: -58.4383 },
  { nombre: 'Villa del Parque', lat: -34.6072, lng: -58.4914 },
  { nombre: 'Villa Devoto', lat: -34.5953, lng: -58.5186 },
  { nombre: 'Villa General Mitre', lat: -34.6150, lng: -58.4789 },
  { nombre: 'Villa Lugano', lat: -34.6775, lng: -58.4714 },
  { nombre: 'Villa Luro', lat: -34.6386, lng: -58.5006 },
  { nombre: 'Villa Ortúzar', lat: -34.5786, lng: -58.4700 },
  { nombre: 'Villa Pueyrredón', lat: -34.5825, lng: -58.5075 },
  { nombre: 'Villa Real', lat: -34.6161, lng: -58.5272 },
  { nombre: 'Villa Riachuelo', lat: -34.6811, lng: -58.4542 },
  { nombre: 'Villa Santa Rita', lat: -34.6186, lng: -58.4922 },
  { nombre: 'Villa Soldati', lat: -34.6692, lng: -58.4292 },
  { nombre: 'Villa Urquiza', lat: -34.5725, lng: -58.4878 },
  { nombre: 'Avellaneda', lat: -34.6626, lng: -58.3656 },
  { nombre: 'Lanús', lat: -34.7059, lng: -58.3922 },
  { nombre: 'Quilmes', lat: -34.7206, lng: -58.2694 },
  { nombre: 'Lomas de Zamora', lat: -34.7600, lng: -58.4000 },
  { nombre: 'Morón', lat: -34.6534, lng: -58.6198 },
  { nombre: 'San Isidro', lat: -34.4708, lng: -58.5267 },
  { nombre: 'Vicente López', lat: -34.5264, lng: -58.4789 },
  { nombre: 'San Martín', lat: -34.5733, lng: -58.5392 },
  { nombre: 'La Plata', lat: -34.9215, lng: -57.9545 },
  { nombre: 'Tigre', lat: -34.4264, lng: -58.5796 },
];

function aRadianes(grados) {
  return (grados * Math.PI) / 180;
}

export function distanciaKm(a, b) {
  const R = 6371;
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const sa = Math.sin(dLat / 2) ** 2 + Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
}

/** Devuelve { nombre, distanciaKm } o null si el barrio más cercano está a más de maxKm. */
export function barrioMasCercano(lat, lng, maxKm = 15) {
  let mejor = null;
  for (const barrio of BARRIOS) {
    const distancia = distanciaKm({ lat, lng }, barrio);
    if (!mejor || distancia < mejor.distanciaKm) mejor = { nombre: barrio.nombre, distanciaKm: distancia };
  }
  if (!mejor || mejor.distanciaKm > maxKm) return null;
  return { nombre: mejor.nombre, distanciaKm: Math.round(mejor.distanciaKm * 10) / 10 };
}

function sinTildes(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filtrarBarrios(texto = '') {
  const normalizado = sinTildes(texto.trim());
  const filtrados = normalizado ? BARRIOS.filter(b => sinTildes(b.nombre).includes(normalizado)) : BARRIOS;
  return filtrados.slice(0, 8).map(b => b.nombre);
}

/** Prioridad: ubicación del dispositivo > centroide del barrio elegido > null (deshabilita "más cercanos"). */
export function puntoDeReferencia(criterios = {}) {
  if (typeof criterios.lat === 'number' && typeof criterios.lng === 'number') return { lat: criterios.lat, lng: criterios.lng };
  const barrio = BARRIOS.find(b => b.nombre === criterios.barrio);
  return barrio ? { lat: barrio.lat, lng: barrio.lng } : null;
}
