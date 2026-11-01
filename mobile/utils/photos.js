export class PhotoReadError extends Error {}

// Un JPEG en base64 siempre empieza con "/9j/" y un PNG con "iVBORw0KGgo".
// Sirve para detectar a tiempo una lectura fallida, antes de mandar datos inservibles al servidor.
export function looksLikeImage(base64) {
  return typeof base64 === 'string' && (base64.startsWith('/9j/') || base64.startsWith('iVBORw0KGgo'));
}

// Las fotos se guardan como { uri, base64 }. Acepta también una URI suelta (borradores o colas viejas).
export function normalizePhoto(photo) {
  return typeof photo === 'string' ? { uri: photo } : photo;
}

// Lee la foto desde su URI local y devuelve el base64 sin prefijo "data:". Solo se usa si la foto no trae base64.
async function readFromUri(uri) {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('lectura fallida'));
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') return reject(new Error('lectura fallida'));
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

// Devuelve el base64 de una foto. Lo normal es que ya lo traiga: expo-image-picker lo entrega al elegirla
// (igual que en Editar perfil). Si no lo trae (foto de un borrador recuperado), se lee del archivo.
export async function photoToBase64(photo) {
  const { uri, base64 } = normalizePhoto(photo);
  let result = base64;
  if (!result) {
    try {
      result = await readFromUri(uri);
    } catch {
      result = null;
    }
  }
  if (!looksLikeImage(result)) {
    throw new PhotoReadError('No se pudo leer una de las fotos. Quitala y volvé a agregarla.');
  }
  return result;
}
