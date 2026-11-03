// Punto 9 + punto 6: última lista de alertas y de seguidas cargada con conexión, para
// mostrarla sin conexión. Se guarda por usuario porque el dispositivo puede ser compartido.
import AsyncStorage from '@react-native-async-storage/async-storage';

const clave = (tipo, userId) => `hallado.offline.${tipo}.${userId}`;

export async function guardarLista(tipo, userId, datos) {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(clave(tipo, userId), JSON.stringify({ datos, guardadoEn: Date.now() }));
  } catch {
    // Sin consecuencias: solo se pierde la copia para usar sin conexión.
  }
}

// { datos, guardadoEn } o null si nunca se guardó.
export async function leerLista(tipo, userId) {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(clave(tipo, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
