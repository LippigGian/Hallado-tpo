// Punto 6 - Modo sin conexión.
// Informa si hay conexión y, al recuperarla, envía las publicaciones pendientes.
import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  ESTADO_PENDIENTE, listarPendientes, procesarPendientes, suscribirseAPendientes,
} from '../services/offline/pendingPublications';

const ConnectivityContext = createContext({ isOnline: true, pendientes: [], ultimoEnvio: null, sincronizarPendientes: async () => {} });

// isInternetReachable puede ser null mientras NetInfo todavía no lo comprobó:
// en ese caso se confía en isConnected para no bloquear la app sin motivo.
function estaEnLinea(estado) {
  return estado.isConnected === true && estado.isInternetReachable !== false;
}

export function idDeUsuario(user) {
  return user?.id ?? user?.email ?? null;
}

export function ConnectivityProvider({ children }) {
  const { user } = useAuth();
  const userId = idDeUsuario(user);
  const [isOnline, setIsOnline] = useState(true);
  const [pendientes, setPendientes] = useState([]);
  const [ultimoEnvio, setUltimoEnvio] = useState(null);
  const estabaEnLinea = useRef(true);

  const sincronizarPendientes = useCallback(async () => {
    if (!userId) return null;
    const resumen = await procesarPendientes(userId);
    if (resumen.enviadas || resumen.conError) setUltimoEnvio({ ...resumen, fecha: Date.now() });
    return resumen;
  }, [userId]);

  useEffect(() => NetInfo.addEventListener(estado => {
    const ahora = estaEnLinea(estado);
    setIsOnline(ahora);
    if (ahora && !estabaEnLinea.current) sincronizarPendientes();
    estabaEnLinea.current = ahora;
  }), [sincronizarPendientes]);

  useEffect(() => {
    if (!userId) { setPendientes([]); return undefined; }
    let activo = true;
    listarPendientes(userId).then(items => { if (activo) setPendientes(items); });
    // Al iniciar sesión con conexión, se intenta enviar lo que haya quedado pendiente.
    NetInfo.fetch().then(estado => { if (activo && estaEnLinea(estado)) sincronizarPendientes(); });
    const desuscribir = suscribirseAPendientes((id, items) => {
      if (activo && id === userId) setPendientes(items);
    });
    return () => { activo = false; desuscribir(); };
  }, [userId, sincronizarPendientes]);

  return (
    <ConnectivityContext.Provider value={{
      isOnline,
      pendientes,
      cantidadPendientes: pendientes.filter(p => p.estado === ESTADO_PENDIENTE).length,
      ultimoEnvio,
      sincronizarPendientes,
    }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}
