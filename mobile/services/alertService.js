// Punto 9 - Alertas, publicaciones seguidas y novedades (ver docs/alertas-seguidas.md).
// Seguir y dejar de seguir siguen en publicationService.js (punto 4).
import { api } from './api';

const id = value => encodeURIComponent(value);

// { alerts: [...], max_alerts }
export async function listAlerts() {
  return (await api.get('/alerts')).data;
}

// `cuerpo` sale de criteriosAAlerta (searchCriteria.js), con fechas concretas.
export async function createAlert(cuerpo) {
  return (await api.post('/alerts', cuerpo)).data.alert;
}

export async function setAlertPaused(alertId, paused) {
  return (await api.patch(`/alerts/${id(alertId)}`, { paused })).data.alert;
}

export async function deleteAlert(alertId) {
  await api.delete(`/alerts/${id(alertId)}`);
}

// { alert, results (con is_new), page, total, has_more }
export async function getAlertPublications(alertId, page = 1) {
  return (await api.get(`/alerts/${id(alertId)}/publications`, { params: { page } })).data;
}

// Deja la alerta sin novedades. Se llama al mostrar la primera página de coincidencias.
export async function markAlertSeen(alertId) {
  return (await api.post(`/alerts/${id(alertId)}/seen`)).data.alert;
}

// Publicaciones seguidas con status, previous_status y has_update. Abrir el detalle de una
// seguida (GET /publications/:id) la marca como vista.
export async function getFollowedPublications() {
  return (await api.get('/follows')).data.publications;
}

// { alerts: { new_publications, with_news }, follows: { updated } }
export async function getNovelties() {
  return (await api.get('/me/novelties')).data;
}
