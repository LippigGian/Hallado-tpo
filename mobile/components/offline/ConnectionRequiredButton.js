// Punto 6 - Botón para acciones que necesitan conexión (reclamar, aceptar un reclamo,
// seguir una publicación, etc.). Sin conexión queda deshabilitado y explica por qué.
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useConnectivity } from '../../context/ConnectivityContext';

export const MENSAJE_REQUIERE_CONEXION = 'Necesitás conexión a internet para continuar.';

export default function ConnectionRequiredButton({ titulo, onPress, disabled, variante = 'primario', mensaje, style }) {
  const { isOnline } = useConnectivity();
  const bloqueado = disabled || !isOnline;
  const secundario = variante === 'secundario';
  return (
    <View style={style}>
      <TouchableOpacity
        style={[styles.boton, secundario && styles.botonSecundario, bloqueado && styles.botonBloqueado]}
        accessibilityRole="button"
        accessibilityState={{ disabled: bloqueado }}
        accessibilityHint={!isOnline ? (mensaje || MENSAJE_REQUIERE_CONEXION) : undefined}
        disabled={bloqueado}
        onPress={onPress}
      >
        <Text style={[styles.texto, secundario && styles.textoSecundario, bloqueado && styles.textoBloqueado]}>{titulo}</Text>
      </TouchableOpacity>
      {!isOnline && <Text style={styles.aviso}>{mensaje || MENSAJE_REQUIERE_CONEXION}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  boton: { backgroundColor: '#205B46', minHeight: 52, padding: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  botonSecundario: { backgroundColor: 'white', borderWidth: 1, borderColor: '#205B46' },
  botonBloqueado: { backgroundColor: '#D5DDD9', borderColor: '#D5DDD9' },
  texto: { color: 'white', fontSize: 16, fontWeight: '600' },
  textoSecundario: { color: '#205B46' },
  textoBloqueado: { color: '#6B7B74' },
  aviso: { color: '#8A3B2E', fontSize: 14, lineHeight: 20, marginTop: 6 },
});
