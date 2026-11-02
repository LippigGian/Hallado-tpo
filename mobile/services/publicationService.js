import { api } from './api';
import { photoUri } from './profileService';

export async function searchPublications(params) {
  return (await api.get('/publications', { params })).data;
}

export async function getPublication(id) {
  return (await api.get(`/publications/${encodeURIComponent(id)}`)).data.publication;
}

export async function followPublication(id) {
  return (await api.post(`/publications/${encodeURIComponent(id)}/follow`)).data;
}

export async function unfollowPublication(id) {
  return (await api.delete(`/publications/${encodeURIComponent(id)}/follow`)).data;
}

// Agrega `fotos` con URLs absolutas, formato que entiende offlineCache.js para descargarlas.
export function conFotosAbsolutas(publicacion) {
  return { ...publicacion, fotos: (publicacion.photos || []).map(foto => photoUri(foto.url)) };
}
