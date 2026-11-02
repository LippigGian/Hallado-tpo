// Punto 3 - Buscador inicial y resultados: últimas búsquedas y alertas guardadas en el
// dispositivo (ver docs/buscador-resultados.md, sección "Integración con las partes del
// grupo" para cómo el punto 9 puede migrar estas alertas a un backend real).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { agregarReciente, marcarComoAlerta, quitarAlerta as quitarAlertaDeLista } from './searchCriteria';

function clave(userId) {
  return `hallado.busquedas.${userId}`;
}

async function leer(userId) {
  try {
    const raw = await AsyncStorage.getItem(clave(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function escribir(userId, lista) {
  await AsyncStorage.setItem(clave(userId), JSON.stringify(lista));
}

export async function listarBusquedas(userId) {
  if (!userId) return [];
  return leer(userId);
}

export async function registrarBusqueda(userId, criterios) {
  if (!userId) return [];
  const lista = agregarReciente(await leer(userId), criterios);
  await escribir(userId, lista);
  return lista;
}

export async function guardarComoAlerta(userId, criterios) {
  if (!userId) return [];
  const lista = marcarComoAlerta(await leer(userId), criterios);
  await escribir(userId, lista);
  return lista;
}

export async function quitarAlertaGuardada(userId, clave_) {
  if (!userId) return [];
  const lista = quitarAlertaDeLista(await leer(userId), clave_);
  await escribir(userId, lista);
  return lista;
}
