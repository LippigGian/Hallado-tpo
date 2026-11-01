// Punto 3 - Buscador inicial y resultados: ubicación actual del dispositivo.
import * as Location from 'expo-location';

export async function obtenerUbicacionActual() {
  const permiso = await Location.requestForegroundPermissionsAsync();
  if (permiso.status !== 'granted') {
    throw new Error('Necesitamos permiso de ubicación. También podés elegir tu barrio de la lista.');
  }
  try {
    const ultima = await Location.getLastKnownPositionAsync();
    const posicion = ultima || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      lat: Math.round(posicion.coords.latitude * 100) / 100,
      lng: Math.round(posicion.coords.longitude * 100) / 100,
    };
  } catch {
    throw new Error('No pudimos obtener tu ubicación.');
  }
}
