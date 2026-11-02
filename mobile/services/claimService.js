import { api } from './api';
import { photoToBase64 } from '../utils/photos';

const UPLOAD_TIMEOUT_MS = 60000;
const claimPath = id => `/claims/${encodeURIComponent(id)}`;

export async function createClaim({ photo, ...fields }) {
  const body = photo ? { ...fields, photo: await photoToBase64(photo) } : fields;
  return (await api.post('/claims', body, { timeout: UPLOAD_TIMEOUT_MS })).data.claim;
}

export async function getMyClaims() {
  return (await api.get('/claims/mine')).data;
}

export async function getClaim(id) {
  return (await api.get(claimPath(id))).data.claim;
}

export async function acceptClaim(id) {
  return (await api.post(`${claimPath(id)}/accept`)).data.claim;
}

export async function rejectClaim(id) {
  return (await api.post(`${claimPath(id)}/reject`)).data.claim;
}

export async function getCounterpartPhone(userId, claimId) {
  const response = await api.get(`/profiles/${encodeURIComponent(userId)}/contact`, { params: { claimId } });
  return response.data.phone;
}

// Punto 8: acuerdo del punto de encuentro de un reclamo aceptado.
export async function getMeetingPoint(claimId) {
  return (await api.get(`${claimPath(claimId)}/meeting-point`)).data.meeting_point;
}

/** Propone el primer punto o sugiere uno alternativo: { direccion, horario, referencia }. */
export async function proposeMeetingPoint(claimId, datos) {
  return (await api.post(`${claimPath(claimId)}/meeting-point/proposals`, datos)).data.meeting_point;
}

export async function acceptMeetingPoint(claimId) {
  return (await api.post(`${claimPath(claimId)}/meeting-point/accept`)).data.meeting_point;
}
