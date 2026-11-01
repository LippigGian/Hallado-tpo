import { api } from './api';
import { photoToBase64 } from '../utils/photos';

// Subir fotos puede tardar más que el resto de las llamadas.
const UPLOAD_TIMEOUT_MS = 60000;

/**
 * Publica una pérdida o un hallazgo. `data` es el resultado de buildPayload(): las fotos llegan como
 * { uri, base64 } (o una URI suelta) y acá se convierten a base64. Devuelve la publicación creada.
 * Esta misma función sirve para reenviar publicaciones guardadas sin conexión (punto 6).
 */
export async function createPublication({ photos, ...fields }) {
  const encodedPhotos = await Promise.all(photos.map(photoToBase64));
  const response = await api.post('/publications', { ...fields, photos: encodedPhotos }, { timeout: UPLOAD_TIMEOUT_MS });
  return response.data.publication;
}

export async function getMyPublications() {
  return (await api.get('/publications/mine')).data.publications;
}

export async function getPublication(id) {
  return (await api.get(`/publications/${encodeURIComponent(id)}`)).data.publication;
}

export async function renewPublication(id) {
  return (await api.post(`/publications/${encodeURIComponent(id)}/renew`)).data.publication;
}
