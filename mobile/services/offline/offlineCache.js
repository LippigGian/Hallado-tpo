// Punto 6 - Modo sin conexión.
// Guarda en el dispositivo las últimas publicaciones consultadas (detalle, fotos y barrio)
// y los últimos resultados de búsqueda cargados con éxito, para mostrarlos sin conexión.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const PUBLICACIONES_KEY = 'hallado.offline.publicaciones';
const BUSQUEDAS_KEY = 'hallado.offline.busquedas';
const MAX_PUBLICACIONES = 20;
const MAX_BUSQUEDAS = 10;
const CARPETA_FOTOS = 'hallado-offline-fotos';

async function leerJson(key, porDefecto) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : porDefecto;
  } catch {
    return porDefecto;
  }
}

async function escribirJson(key, valor) {
  await AsyncStorage.setItem(key, JSON.stringify(valor));
}

function carpetaDePublicacion(id) {
  return new Directory(Paths.document, CARPETA_FOTOS, String(id));
}

// Acepta fotos como strings (URL) u objetos con url/uri, según lo que devuelva la API.
function urlDeFoto(foto) {
  if (typeof foto === 'string') return foto;
  return foto?.url || foto?.uri || null;
}

async function descargarFotos(publicacion) {
  const urls = (publicacion.fotos || []).map(urlDeFoto).filter(Boolean);
  if (!urls.length) return [];
  const carpeta = carpetaDePublicacion(publicacion.id);
  try {
    if (!carpeta.exists) carpeta.create({ intermediates: true, idempotent: true });
  } catch {
    return [];
  }
  const locales = [];
  for (let i = 0; i < urls.length; i += 1) {
    if (!/^https?:\/\//i.test(urls[i])) continue;
    try {
      const destino = new File(carpeta, `foto-${i}.jpg`);
      const archivo = await File.downloadFileAsync(urls[i], destino, { idempotent: true });
      locales.push(archivo.uri);
    } catch {
      // Si una foto no se puede descargar, se guarda el resto del detalle igualmente.
    }
  }
  return locales;
}

function borrarFotos(id) {
  try {
    const carpeta = carpetaDePublicacion(id);
    if (carpeta.exists) carpeta.delete();
  } catch {
    // Sin consecuencias: solo libera espacio.
  }
}

/**
 * Llamar cada vez que se muestra el detalle de una publicación obtenido de la API.
 * Requiere `publicacion.id`. Conserva las últimas MAX_PUBLICACIONES consultadas.
 */
export async function guardarPublicacionVista(publicacion) {
  if (!publicacion || publicacion.id === undefined || publicacion.id === null) return;
  const fotosLocales = await descargarFotos(publicacion);
  const guardadas = await leerJson(PUBLICACIONES_KEY, []);
  const anterior = guardadas.find(item => String(item.publicacion.id) === String(publicacion.id));
  const registro = {
    publicacion,
    // Si esta vez no se pudo descargar ninguna foto, se mantienen las anteriores.
    fotosLocales: fotosLocales.length ? fotosLocales : anterior?.fotosLocales || [],
    guardadoEn: Date.now(),
  };
  const resto = guardadas.filter(item => String(item.publicacion.id) !== String(publicacion.id));
  const actualizadas = [registro, ...resto];
  actualizadas.slice(MAX_PUBLICACIONES).forEach(item => borrarFotos(item.publicacion.id));
  await escribirJson(PUBLICACIONES_KEY, actualizadas.slice(0, MAX_PUBLICACIONES));
}

/** Devuelve { publicacion, fotosLocales, guardadoEn } o null si no está guardada. */
export async function obtenerPublicacionGuardada(id) {
  const guardadas = await leerJson(PUBLICACIONES_KEY, []);
  return guardadas.find(item => String(item.publicacion.id) === String(id)) || null;
}

/** Lista de publicaciones guardadas, de la más reciente a la más antigua. */
export async function listarPublicacionesGuardadas() {
  return leerJson(PUBLICACIONES_KEY, []);
}

// Misma búsqueda => misma clave, sin importar el orden de los campos.
export function claveDeBusqueda(criterios = {}) {
  const ordenados = Object.keys(criterios)
    .filter(k => criterios[k] !== undefined && criterios[k] !== null && criterios[k] !== '')
    .sort()
    .reduce((acc, k) => ({ ...acc, [k]: criterios[k] }), {});
  return JSON.stringify(ordenados);
}

/** Llamar cuando una búsqueda devuelve resultados de la API correctamente. */
export async function guardarResultadosBusqueda(criterios, resultados) {
  const clave = claveDeBusqueda(criterios);
  const busquedas = await leerJson(BUSQUEDAS_KEY, []);
  const resto = busquedas.filter(item => item.clave !== clave);
  const registro = { clave, criterios, resultados: resultados || [], guardadoEn: Date.now() };
  await escribirJson(BUSQUEDAS_KEY, [registro, ...resto].slice(0, MAX_BUSQUEDAS));
}

/**
 * Sin conexión: devuelve los últimos resultados cargados con éxito.
 * Si esa búsqueda exacta nunca se hizo, devuelve la búsqueda más reciente
 * con `coincideConBusqueda: false` para avisarlo en la pantalla.
 * Devuelve null si no hay nada guardado.
 */
export async function obtenerResultadosGuardados(criterios) {
  const busquedas = await leerJson(BUSQUEDAS_KEY, []);
  if (!busquedas.length) return null;
  const exacta = busquedas.find(item => item.clave === claveDeBusqueda(criterios));
  const registro = exacta || busquedas[0];
  return { ...registro, coincideConBusqueda: Boolean(exacta) };
}

/** Borra todo lo guardado para uso sin conexión (por ejemplo, al cerrar sesión). */
export async function limpiarCacheOffline() {
  const guardadas = await leerJson(PUBLICACIONES_KEY, []);
  guardadas.forEach(item => borrarFotos(item.publicacion.id));
  await AsyncStorage.multiRemove([PUBLICACIONES_KEY, BUSQUEDAS_KEY]);
}
