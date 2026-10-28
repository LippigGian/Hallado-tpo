import { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, SESSION_KEY } from '../services/api';
import { loginRequest } from '../services/authService';

export const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');

  async function logout() {
    // Si falla el borrado, no fingir que la sesión persistida fue eliminada.
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setSession(null);
  }

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw);
        if (!stored.token || !Number.isFinite(stored.expiresAt) || stored.expiresAt <= Date.now()) {
          await SecureStore.deleteItemAsync(SESSION_KEY);
          return;
        }
        // El servidor verifica firma, expiración y existencia del usuario.
        const response = await api.get('/auth/me');
        if (active) setSession({ ...stored, user: response.data.user });
      } catch (error) {
        if (error.response?.status === 401 || error instanceof SyntaxError) {
          await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
        }
        if (active) setSessionMessage('No se pudo restaurar la sesión. Ingresá nuevamente.');
      } finally { if (active) setLoading(false); }
    }
    restore();
    const interceptor = api.interceptors.response.use(response => response, async error => {
      if (error.response?.status === 401 && error.config?.url === '/auth/me') {
        await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
        if (active) setSession(null);
      }
      return Promise.reject(error);
    });
    return () => { active = false; api.interceptors.response.eject(interceptor); };
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      setSession(null);
      setSessionMessage('Tu sesión venció. Ingresá nuevamente.');
      SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
    }, Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);

  async function login(email, password) {
    const response = await loginRequest(email.trim().toLowerCase(), password);
    const next = { token: response.token, user: response.user, expiresAt: Date.now() + response.expiresIn * 1000 };
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    setSessionMessage('');
    setSession(next);
  }
  return <AuthContext.Provider value={{ user: session?.user || null, loading, login, logout, sessionMessage }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
