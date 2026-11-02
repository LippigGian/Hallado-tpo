import { api } from './api';
import { photoToBase64 } from '../utils/photos';

const UPLOAD_TIMEOUT_MS = 60000;

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
