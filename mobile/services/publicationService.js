import { api } from './api';
import { photoUri } from './profileService';

export async function searchPublications(params) {
  return (await api.get('/publications', { params })).data;
}

// Agrega `fotos` con URLs absolutas, formato que entiende offlineCache.js para descargarlas.
export function conFotosAbsolutas(publicacion) {
  return { ...publicacion, fotos: (publicacion.photos || []).map(foto => photoUri(foto.url)) };
}
