// Punto 9 - "Mis alertas": ver, pausar o eliminar las alertas, con la cantidad de
// publicaciones nuevas que coinciden con cada una. Sin conexión muestra la última lista
// guardada (punto 6) y las acciones quedan deshabilitadas.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { idDeUsuario, useConnectivity } from '../context/ConnectivityContext';
import { colors } from '../config/theme';
import PrimaryButton from '../components/PrimaryButton';
import { MENSAJE_REQUIERE_CONEXION } from '../components/offline/ConnectionRequiredButton';
import { deleteAlert, listAlerts, setAlertPaused } from '../services/alertService';
import { guardarLista, leerLista } from '../services/alerts/alertsCache';
import { migrarAlertasLocales } from '../services/alerts/localAlertsMigration';
import { describirAlerta, describirFechaAlerta, textoNovedadAlerta } from '../services/search/searchCriteria';
import { getApiError } from '../services/api';
import { formatShortDateTime } from '../utils/dateTime';

export default function MyAlertsScreen({ navigation }) {
  const { user } = useAuth();
  const userId = idDeUsuario(user);
  const { isOnline } = useConnectivity();
  const [alertas, setAlertas] = useState(null);
  const [maximo, setMaximo] = useState(10);
  // Sin conexión: fecha de la copia mostrada (0 si no hay ninguna). Con conexión: null.
  const [copiaDel, setCopiaDel] = useState(null);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [ocupada, setOcupada] = useState(null);

  const cargar = useCallback(async () => {
    setError('');
    const usarCopia = async () => {
      const copia = await leerLista('alertas', userId);
      setAlertas(copia?.datos || []);
      setCopiaDel(copia?.guardadoEn ?? 0);
    };
    if (!isOnline) { await usarCopia(); return; }
    try {
      await migrarAlertasLocales(userId);
      const respuesta = await listAlerts();
      setAlertas(respuesta.alerts);
      setMaximo(respuesta.max_alerts);
      setCopiaDel(null);
      await guardarLista('alertas', userId, respuesta.alerts);
    } catch (err) {
      if (!err.response) await usarCopia();
      else {
        setError(getApiError(err));
        setAlertas(actuales => actuales || []);
      }
    }
  }, [isOnline, userId]);

  // Al volver de las coincidencias, el contador de esa alerta ya quedó en 0.
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  function reemplazar(lista) {
    setAlertas(lista);
    guardarLista('alertas', userId, lista);
  }

  async function alternarPausa(alerta) {
    setOcupada(alerta.id);
    setError('');
    try {
      const actualizada = await setAlertPaused(alerta.id, !alerta.paused);
      reemplazar(alertas.map(a => (a.id === actualizada.id ? actualizada : a)));
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setOcupada(null);
    }
  }

  async function eliminar(alerta) {
    setOcupada(alerta.id);
    setError('');
    try {
      await deleteAlert(alerta.id);
      reemplazar(alertas.filter(a => a.id !== alerta.id));
    } catch (err) {
      // Si ya no existía, igual se quita de la lista.
      if (err.response?.status === 404) reemplazar(alertas.filter(a => a.id !== alerta.id));
      else setError(getApiError(err));
    } finally {
      setOcupada(null);
    }
  }

  function confirmarEliminar(alerta) {
    Alert.alert('Eliminar alerta', `¿Eliminar la alerta "${describirAlerta(alerta)}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => eliminar(alerta) },
    ]);
  }

  if (alertas === null) return <ActivityIndicator style={styles.cargando} size="large" accessibilityLabel="Cargando alertas" />;

  const header = (
    <View style={styles.header}>
      <Text style={styles.texto}>
        Te mostramos acá cuántas publicaciones nuevas coinciden con cada búsqueda guardada. Para crear una alerta, buscá y tocá
        “Guardar búsqueda como alerta”.
      </Text>
      {!!alertas.length && <Text style={styles.textoSecundario}>{alertas.length} de {maximo} alertas</Text>}
      {copiaDel !== null && (
        <Text style={styles.advertencia} accessibilityRole="alert">
          {copiaDel
            ? `Sin conexión. Mostramos tus alertas guardadas el ${formatShortDateTime(copiaDel)}; los contadores podrían no estar actualizados.`
            : 'Sin conexión y sin alertas guardadas en este dispositivo.'}
          {' '}{MENSAJE_REQUIERE_CONEXION}
        </Text>
      )}
      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );

  const vacio = copiaDel === 0 ? null : (
    <View>
      <Text style={styles.vacio}>Todavía no guardaste ninguna alerta.</Text>
      <PrimaryButton title="Ir al buscador" onPress={() => navigation.navigate('Search')} style={styles.espacio} />
    </View>
  );

  return (
    <FlatList
      style={styles.lista}
      contentContainerStyle={styles.contenido}
      data={alertas}
      keyExtractor={item => item.id}
      refreshing={refrescando}
      onRefresh={isOnline ? refrescar : undefined}
      ListHeaderComponent={header}
      ListEmptyComponent={vacio}
      renderItem={({ item }) => {
        const conNovedad = !item.paused && item.new_count > 0;
        const bloqueada = !isOnline || ocupada === item.id;
        return (
          <View style={[styles.tarjeta, conNovedad && styles.tarjetaNovedad, item.paused && styles.tarjetaPausada]}>
            <TouchableOpacity accessibilityRole="button" accessibilityHint="Muestra las publicaciones que coinciden con esta alerta"
              accessibilityState={{ disabled: !isOnline }} disabled={!isOnline}
              onPress={() => navigation.navigate('AlertResults', { alertId: item.id, alerta: item })}>
              <Text style={styles.titulo}>{describirAlerta(item)}</Text>
              <Text style={styles.textoSecundario}>Fecha del suceso: {describirFechaAlerta(item)}</Text>
              <View style={[styles.insignia, conNovedad && styles.insigniaNovedad, item.paused && styles.insigniaPausada]}>
                <Text style={[styles.insigniaTexto, conNovedad && styles.insigniaNovedadTexto]}>{textoNovedadAlerta(item)}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.acciones}>
              <TouchableOpacity style={[styles.accion, bloqueada && styles.accionBloqueada]} accessibilityRole="button"
                accessibilityState={{ disabled: bloqueada }} disabled={bloqueada} onPress={() => alternarPausa(item)}>
                <Text style={styles.accionTexto}>{item.paused ? 'Reanudar' : 'Pausar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.accion, bloqueada && styles.accionBloqueada]} accessibilityRole="button"
                accessibilityState={{ disabled: bloqueada }} disabled={bloqueada} onPress={() => confirmarEliminar(item)}>
                <Text style={[styles.accionTexto, styles.accionEliminar]}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  cargando: { flex: 1 },
  lista: { backgroundColor: colors.background },
  contenido: { padding: 20, paddingBottom: 140 },
  header: { marginBottom: 12 },
  texto: { fontSize: 15, lineHeight: 22, color: colors.muted },
  textoSecundario: { fontSize: 13, lineHeight: 19, color: '#6B7B74', marginTop: 4 },
  advertencia: { fontSize: 14, lineHeight: 20, color: '#8A3B2E', marginTop: 12 },
  error: { fontSize: 14, lineHeight: 20, color: colors.error, marginTop: 12 },
  vacio: { fontSize: 16, lineHeight: 24, color: colors.muted, marginTop: 8 },
  espacio: { marginTop: 12 },
  tarjeta: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E1E7E4' },
  tarjetaNovedad: { borderColor: colors.primary, borderWidth: 2 },
  tarjetaPausada: { backgroundColor: '#F1F3F2' },
  titulo: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
  insignia: { alignSelf: 'flex-start', backgroundColor: '#E1E7E4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8 },
  insigniaNovedad: { backgroundColor: colors.primary },
  insigniaPausada: { backgroundColor: '#F4E6C8' },
  insigniaTexto: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  insigniaNovedadTexto: { color: 'white' },
  acciones: { flexDirection: 'row', gap: 8, marginTop: 12 },
  accion: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  accionBloqueada: { borderColor: '#D5DDD9', opacity: 0.6 },
  accionTexto: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  accionEliminar: { color: colors.error },
});
