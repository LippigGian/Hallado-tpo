export class PhotoReadError extends Error {}

export function looksLikeImage(base64) {
  return typeof base64 === 'string' && (base64.startsWith('/9j/') || base64.startsWith('iVBORw0KGgo'));
}

export function normalizePhoto(photo) {
  return typeof photo === 'string' ? { uri: photo } : photo;
}

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
