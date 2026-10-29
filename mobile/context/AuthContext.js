import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { authenticateBiometric } from '../services/biometricSupport';
import { api, SESSION_KEY } from '../services/api';
import { loginRequest } from '../services/authService';

export const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');
  const sessionRef = useRef(null);
  const authenticating = useRef(false);

  function updateSession(value) {
    sessionRef.current = value;
    setSession(value);
  }
  async function logout() {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    updateSession(null);
    setLocked(false);
    setSessionMessage('');
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
        if (stored.biometricEnabled === true) {
          // No exponer la navegación autenticada antes de comprobar la biometría.
          if (active) { setLocked(true); updateSession(stored); }
          return;
        }
        const response = await api.get('/auth/me');
        if (active) updateSession({ ...stored, user: response.data.user });
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
        if (active) { updateSession(null); setLocked(false); setSessionMessage('Tu sesión ya no es válida. Ingresá nuevamente.'); }
      }
      return Promise.reject(error);
    });
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background' && sessionRef.current?.biometricEnabled && !authenticating.current) setLocked(true);
      if (state === 'active' && sessionRef.current?.expiresAt <= Date.now()) {
        updateSession(null);
        setLocked(false);
        setSessionMessage('Tu sesión venció. Ingresá nuevamente.');
        SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
      }
    });
    return () => { active = false; subscription.remove(); api.interceptors.response.eject(interceptor); };
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      updateSession(null);
      setLocked(false);
      setSessionMessage('Tu sesión venció. Ingresá nuevamente.');
      SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
    }, Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);

  async function login(email, password) {
    const response = await loginRequest(email.trim().toLowerCase(), password);
    const next = { token: response.token, user: response.user, expiresAt: Date.now() + response.expiresIn * 1000, biometricEnabled: false };
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    setSessionMessage('');
    setLocked(false);
    updateSession(next);
  }

  async function biometricAction(action) {
    if (authenticating.current) return;
    authenticating.current = true;
    try { await authenticateBiometric(LocalAuthentication); await action(); }
    finally {
      authenticating.current = false;
      if (AppState.currentState === 'background' && sessionRef.current?.biometricEnabled) setLocked(true);
    }
  }

  async function setBiometricEnabled(enabled) {
    await biometricAction(async () => {
      const current = sessionRef.current;
      if (!current || current.expiresAt <= Date.now()) throw new Error('La sesión venció. Ingresá nuevamente.');
      const next = { ...current, biometricEnabled: enabled };
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
      updateSession(next);
    });
  }

  async function unlock() {
    await biometricAction(async () => {
      const current = sessionRef.current;
      if (!current || current.expiresAt <= Date.now()) {
        await logout();
        setSessionMessage('La sesión venció. Ingresá nuevamente.');
        return;
      }
      // La huella desbloquea una sesión local; no reemplaza la validación del servidor.
      const response = await api.get('/auth/me');
      if (sessionRef.current?.token !== current.token) return;
      updateSession({ ...current, user: response.data.user });
      setLocked(false);
    });
  }

  return <AuthContext.Provider value={{ user: !locked ? session?.user || null : null,
    loading, locked, login, logout, sessionMessage, unlock,
    biometricEnabled: session?.biometricEnabled === true, setBiometricEnabled,
    lock: () => { if (sessionRef.current?.biometricEnabled) setLocked(true); },
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
