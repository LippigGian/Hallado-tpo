import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const SESSION_KEY = 'hallado.session';
export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000',
  timeout: 20000,
});
api.interceptors.request.use(async config => {
  if (config.url === '/auth/me') {
    const saved = await SecureStore.getItemAsync(SESSION_KEY);
    const session = saved ? JSON.parse(saved) : null;
    if (session?.token) config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

export function getApiError(error) {
  if (typeof error.response?.data?.error === 'string') return error.response.data.error;
  if (error.code === 'ECONNABORTED') return 'La API tardó demasiado. Intentá nuevamente.';
  if (!error.response) return 'No pudimos conectar con la API. Comprobá que el backend esté encendido y la dirección sea correcta.';
  return 'No se pudo completar la operación. Intentá nuevamente.';
}
