// Punto 6 - Modo sin conexión.
// Cola de publicaciones creadas sin conexión. Quedan "pendiente de envío" y se
// publican automáticamente cuando vuelve la conexión (ver ConnectivityContext).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

export const ESTADO_PENDIENTE = 'pendiente_envio';
export const ESTADO_ERROR = 'error_envio';
const CARPETA_PENDIENTES = 'hallado-offline-pendientes';

let enviador = null;
let procesando = false;
const oyentes = new Set();

const claveDeUsuario = userId => `hallado.offline.pendientes.${userId}`;

async function leer(userId) {
  try {
    const raw = await AsyncStorage.getItem(claveDeUsuario(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function escribir(userId, items) {
  await AsyncStorage.setItem(claveDeUsuario(userId), JSON.stringify(items));
  oyentes.forEach(oyente => oyente(userId, items));
}

// Relee la cola antes de modificarla, para no pisar publicaciones agregadas mientras tanto.
async function actualizar(userId, cambio) {
  const items = await leer(userId);
  const nuevos = cambio(items);
  await escribir(userId, nuevos);
  return nuevos;
}

function nuevoIdLocal() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Las fotos elegidas con expo-image-picker quedan en la caché del sistema, que puede
// vaciarse. Se copian a una carpeta propia para que sigan existiendo al momento de enviar.
// Acepta URIs sueltas o objetos { uri, base64 } (formato del formulario de publicar, punto 5);
// el base64 no se guarda en la cola: se vuelve a leer del archivo copiado al enviar.
function copiarFotos(idLocal, fotos = [], prefijo = 'foto') {
  if (!fotos.length) return [];
  const carpeta = new Directory(Paths.document, CARPETA_PENDIENTES, idLocal);
  carpeta.create({ intermediates: true, idempotent: true });
  return fotos.map((foto, i) => {
    const origen = new File(typeof foto === 'string' ? foto : foto.uri);
    const destino = new File(carpeta, `${prefijo}-${i}.jpg`);
    origen.copy(destino);
    return destino.uri;
  });
}

function borrarFotos(idLocal) {
  try {
    const carpeta = new Directory(Paths.document, CARPETA_PENDIENTES, idLocal);
    if (carpeta.exists) carpeta.delete();
  } catch {
    // Solo libera espacio.
  }
}

// Sin respuesta del servidor = problema de conexión: se reintenta al reconectar.
function esErrorDeConexion(error) {
  return Boolean(error?.isAxiosError && !error.response) || error?.message === 'Network request failed';
}

/**
 * Guarda una publicación creada sin conexión. `datos` es el mismo objeto que se enviaría
 * a la API. Las fotos pueden venir en `photos` (objetos { uri, base64 } del formulario de
 * publicar) o en `fotos` (URIs locales); se copian a una carpeta propia.
 * Devuelve el registro con estado "pendiente_envio".
 */
export async function encolarPublicacion(userId, datos = {}) {
  const idLocal = nuevoIdLocal();
  const { fotos, photos, ...resto } = datos;
  const guardados = { ...resto };
  if (Array.isArray(fotos)) guardados.fotos = copiarFotos(idLocal, fotos, 'foto');
  if (Array.isArray(photos)) guardados.photos = copiarFotos(idLocal, photos, 'photo').map(uri => ({ uri }));
  const item = {
    idLocal,
    datos: guardados,
    estado: ESTADO_PENDIENTE,
    creadaEn: Date.now(),
    intentos: 0,
    ultimoError: null,
  };
  await actualizar(userId, items => [...items, item]);
  return item;
}

/**
 * Lee el base64 de cada foto guardada en la cola. Las fotos se guardan como archivo (sin base64,
 * para no llenar AsyncStorage) y `fetch` no puede leer archivos locales en Android, así que se
 * leen con expo-file-system justo antes de enviar.
 */
export async function conFotosLeidas(datos) {
  if (!Array.isArray(datos?.photos)) return datos;
  const photos = await Promise.all(datos.photos.map(async foto => (
    foto.base64 ? foto : { uri: foto.uri, base64: await new File(foto.uri).base64() }
  )));
  return { ...datos, photos };
}

export async function listarPendientes(userId) {
  return leer(userId);
}

export async function descartarPendiente(userId, idLocal) {
  borrarFotos(idLocal);
  await actualizar(userId, items => items.filter(item => item.idLocal !== idLocal));
}

/** Vuelve a poner en cola una publicación que falló por un error de validación. */
export async function reintentarPendiente(userId, idLocal) {
  await actualizar(userId, items => items.map(item => (item.idLocal === idLocal
    ? { ...item, estado: ESTADO_PENDIENTE, ultimoError: null } : item)));
}

/**
 * Registra la función que envía una publicación a la API. ConnectivityContext registra
 * createPublication (punto 5). Debe devolver la publicación creada o lanzar el error.
 */
export function registrarEnviadorPublicaciones(funcion) {
  enviador = funcion;
  return () => { if (enviador === funcion) enviador = null; };
}

export function hayEnviadorRegistrado() {
  return Boolean(enviador);
}

/** Permite que las pantallas se actualicen cuando cambia la cola. */
export function suscribirseAPendientes(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/**
 * Envía las publicaciones pendientes, en el orden en que se crearon.
 * - Si se publica: se quita de la cola.
 * - Si falla por conexión: se corta y se reintenta en la próxima reconexión.
 * - Si el servidor la rechaza (por ejemplo, datos inválidos): queda como "error_envio"
 *   con el mensaje, para que la persona la corrija o la descarte (no se reintenta sola).
 * Devuelve { enviadas, conError, pendientes }.
 */
export async function procesarPendientes(userId) {
  const resumen = { enviadas: 0, conError: 0, pendientes: 0 };
  if (!userId || !enviador || procesando) return resumen;
  procesando = true;
  try {
    const aEnviar = (await leer(userId)).filter(i => i.estado === ESTADO_PENDIENTE);
    for (const item of aEnviar) {
      try {
        await enviador(item.datos);
        borrarFotos(item.idLocal);
        await actualizar(userId, items => items.filter(i => i.idLocal !== item.idLocal));
        resumen.enviadas += 1;
      } catch (error) {
        if (esErrorDeConexion(error)) break;
        const mensaje = typeof error?.response?.data?.error === 'string'
          ? error.response.data.error
          : (!error?.isAxiosError && error?.message) || 'El servidor rechazó la publicación.';
        await actualizar(userId, items => items.map(i => (i.idLocal === item.idLocal
          ? { ...i, estado: ESTADO_ERROR, intentos: i.intentos + 1, ultimoError: mensaje } : i)));
        resumen.conError += 1;
      }
    }
    resumen.pendientes = (await leer(userId)).filter(i => i.estado === ESTADO_PENDIENTE).length;
    return resumen;
  } finally {
    procesando = false;
  }
}
