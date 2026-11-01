// Punto 8 - Botón "Cómo llegar".
// Abre Google Maps en modo navegación con la dirección precargada. Si Google Maps no
// está instalado, usa la app de mapas por defecto y, como último recurso, Google Maps web.
import { Linking, Platform } from 'react-native';

function destinoDe({ direccion, latitud, longitud }) {
  if (direccion && direccion.trim()) return direccion.trim();
  if (Number.isFinite(latitud) && Number.isFinite(longitud)) return `${latitud},${longitud}`;
  return null;
}

/** Lista de URLs a probar, en orden de preferencia, según la plataforma. */
export function urlsComoLlegar(punto, plataforma = Platform.OS) {
  const destino = destinoDe(punto || {});
  if (!destino) return [];
  const q = encodeURIComponent(destino);
  const web = `https://www.google.com/maps/dir/?api=1&destination=${q}&dir_action=navigate`;
  if (plataforma === 'android') {
    return [
      `google.navigation:q=${q}`, // Google Maps directo en navegación
      `geo:0,0?q=${q}`,           // app de mapas por defecto
      web,
    ];
  }
  return [
    `comgooglemaps://?daddr=${q}&directionsmode=driving`, // Google Maps en iOS
    `maps://?daddr=${q}`,                                  // Apple Maps (por defecto en iOS)
    web,
  ];
}

/**
 * Abre la navegación hacia el punto de encuentro.
 * `punto` = { direccion, latitud?, longitud? }. Devuelve la URL que se abrió.
 */
export async function abrirComoLlegar(punto) {
  const urls = urlsComoLlegar(punto);
  if (!urls.length) throw new Error('El punto de encuentro no tiene dirección.');
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return url;
    } catch {
      // Esa app no está instalada: se prueba la siguiente opción.
    }
  }
  throw new Error('No se pudo abrir una aplicación de mapas.');
}
