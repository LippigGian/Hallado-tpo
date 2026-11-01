export class PhotoReadError extends Error {}

// Lee una foto local (la URI que entrega expo-image-picker) y devuelve su contenido en base64, sin prefijo.
export async function uriToBase64(uri) {
  try {
    const blob = await (await fetch(uri)).blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('lectura fallida'));
      reader.onloadend = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== 'string') return reject(new Error('lectura fallida'));
        resolve(dataUrl.slice(dataUrl.indexOf(',') + 1)); // quita "data:image/jpeg;base64,"
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    throw new PhotoReadError('No se pudo leer una de las fotos. Quitala y volvé a agregarla.');
  }
}
