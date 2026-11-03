// Punto 10: historial de casos resueltos, valoraciones y agradecimientos.
import { api } from './api';

// Valoraciones y agradecimientos van sobre la devolución: el `id` de cada caso del historial.
const returnPath = id => `/returns/${encodeURIComponent(id)}`;

/** period: 'mes' | '3meses' | 'anio' | 'todo'. category: categoría o null (todas). */
export async function getHistory({ period, category }) {
  const params = { period };
  if (category) params.category = category;
  return (await api.get('/history', { params })).data;
}

/** datos: { value: 'positive' | 'negative', message? } */
export async function rateCase(id, datos) {
  await api.post(`${returnPath(id)}/rating`, datos);
}

/** datos: { message } */
export async function thankCase(id, datos) {
  await api.post(`${returnPath(id)}/thanks`, datos);
}
