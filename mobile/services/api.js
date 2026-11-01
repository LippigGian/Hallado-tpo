import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const SESSION_KEY = 'hallado.session';
export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000',
  timeout: 20000,
});

// Rutas del backend que no llevan sesión: login, registro y recuperación de contraseña.
// Todas las demás (perfil, publicaciones, reclamos, etc.) reciben el token y, si el servidor
// responde 401, la app cierra la sesión (ver AuthContext).
const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/password-reset'];
export function requiresSession(url = '') {
  return !PUBLIC_PATHS.some(path => url.startsWith(path));
}

// URL completa de un recurso del backend (por ejemplo una foto) a partir de su ruta: "/publications/…/photos/…".
export function apiUrl(path) {
  return path ? `${api.defaults.baseURL.replace(/\/$/, '')}${path}` : null;
}

api.interceptors.request.use(async config => {
  if (requiresSession(config.url)) {
    const saved = await SecureStore.getItemAsync(SESSION_KEY);
    const session = saved ? JSON.parse(saved) : null;
    if (session?.token) config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

export function getApiError(error) {
  if (!axios.isAxiosError(error)) {
    if (__DEV__) console.warn('Hallado: error local al procesar la operación', error?.name, error?.message);
    return 'No se pudo procesar la operación en la app. Intentá nuevamente.';
  }
  if (__DEV__) console.warn('Hallado: petición fallida', error.config?.method, error.config?.url, error.code, error.response?.status);
  if (typeof error.response?.data?.error === 'string') return error.response.data.error;
  if (error.code === 'ECONNABORTED') return 'La API tardó demasiado. Intentá nuevamente.';
  if (!error.response) return 'No pudimos conectar con la API. Comprobá que el backend esté encendido y la dirección sea correcta.';
  return 'No se pudo completar la operación. Intentá nuevamente.';
}
