// Punto 6 - Aviso global de modo sin conexión y de publicaciones pendientes de envío.
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectivity } from '../../context/ConnectivityContext';

export default function OfflineBanner() {
  const { isOnline, cantidadPendientes } = useConnectivity();
  const insets = useSafeAreaInsets();
  if (isOnline && !cantidadPendientes) return null;
  const textoPendientes = cantidadPendientes === 1
    ? '1 publicación pendiente de envío.'
    : `${cantidadPendientes} publicaciones pendientes de envío.`;
  return (
    <View
      style={[styles.banner, isOnline ? styles.enviando : styles.sinConexion, { paddingBottom: 10 + insets.bottom }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {!isOnline && <Text style={styles.titulo}>Sin conexión</Text>}
      <Text style={styles.texto}>
        {isOnline
          ? `Conexión recuperada. Enviando ${textoPendientes}`
          : `Mostramos la información guardada en el dispositivo.${cantidadPendientes ? ` ${textoPendientes}` : ''}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10 },
  sinConexion: { backgroundColor: '#173F35' },
  enviando: { backgroundColor: '#205B46' },
  titulo: { color: 'white', fontWeight: '700', fontSize: 15, marginBottom: 2 },
  texto: { color: 'white', fontSize: 14, lineHeight: 20 },
});
