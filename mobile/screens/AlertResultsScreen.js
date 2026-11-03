// Punto 9 - Coincidencias de una alerta: las publicaciones que coinciden con sus criterios,
// las más recientes primero y con "Nueva" en las publicadas desde la última vez que se abrió.
// Apenas se muestra la primera página, la alerta se marca como vista (su contador vuelve a 0
// en Mis alertas). Para que las páginas siguientes mantengan las marcas de "Nueva", se comparan
// con la última vista que tenía la alerta al abrir esta pantalla.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useConnectivity } from '../context/ConnectivityContext';
import { colors } from '../config/theme';
import PrimaryButton from '../components/PrimaryButton';
import PublicationCard from '../components/search/PublicationCard';
import { MENSAJE_REQUIERE_CONEXION } from '../components/offline/ConnectionRequiredButton';
import { getAlertPublications, markAlertSeen } from '../services/alertService';
import { conFotosAbsolutas } from '../services/publicationService';
import { describirAlerta, describirFechaAlerta } from '../services/search/searchCriteria';
import { getApiError } from '../services/api';

export default function AlertResultsScreen({ route, navigation }) {
  const { alertId } = route.params;
  const { isOnline } = useConnectivity();
  const [alerta, setAlerta] = useState(route.params.alerta || null);
  const [resultados, setResultados] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');
  // Alerta tal como estaba al abrir la pantalla (antes de marcarla como vista).
  const alAbrir = useRef(null);

  const aplicarRespuesta = useCallback((respuesta, pag, acumulado) => {
    setError('');
    if (!alAbrir.current) {
      alAbrir.current = respuesta.alert;
      setAlerta(respuesta.alert);
      markAlertSeen(alertId).catch(() => {});
    }
    const { last_seen_at: vistaAnterior, paused } = alAbrir.current;
    const nuevos = respuesta.results.map(item => ({
      ...conFotosAbsolutas(item),
      is_new: !paused && new Date(item.created_at) > new Date(vistaAnterior),
    }));
    setResultados(pag === 1 ? nuevos : [...acumulado, ...nuevos]);
    setHasMore(respuesta.has_more);
    setTotal(respuesta.total);
    setPagina(pag);
  }, [alertId]);

  // Reintentar y "cargar más": los indicadores de carga los prende quien llama.
  async function cargar(pag, acumulado) {
    try {
      aplicarRespuesta(await getAlertPublications(alertId, pag), pag, acumulado);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setCargando(false);
      setCargandoMas(false);
    }
  }

  // Carga inicial (la pantalla ya arranca en `cargando`) y al recuperar la conexión.
  useEffect(() => {
    if (!isOnline) return undefined;
    let activa = true;
    getAlertPublications(alertId, 1)
      .then(respuesta => { if (activa) aplicarRespuesta(respuesta, 1, []); })
      .catch(err => { if (activa) setError(getApiError(err)); })
      .finally(() => { if (activa) setCargando(false); });
    return () => { activa = false; };
  }, [isOnline, alertId, aplicarRespuesta]);

  function reintentar() {
    setCargando(true);
    setError('');
    cargar(1, []);
  }

  function cargarMas() {
    if (!hasMore || cargando || cargandoMas || !isOnline) return;
    setCargandoMas(true);
    cargar(pagina + 1, resultados);
  }

  // Sin conexión no se carga nada: no se muestra el indicador.
  const mostrandoCarga = cargando && isOnline;

  const nuevas = alerta && !alerta.paused ? alerta.new_count : 0;

  const header = (
    <View style={styles.header}>
      {!!alerta && (
        <>
          <Text style={styles.titulo}>{describirAlerta(alerta)}</Text>
          <Text style={styles.textoSecundario}>Fecha del suceso: {describirFechaAlerta(alerta)}</Text>
        </>
      )}
      {!mostrandoCarga && isOnline && !error && (
        <Text style={styles.texto}>
          {total} coincidencia{total === 1 ? '' : 's'}{nuevas > 0 ? ` · ${nuevas} nueva${nuevas === 1 ? '' : 's'}` : ''}
        </Text>
      )}
      {alerta?.paused && <Text style={styles.advertencia}>Esta alerta está pausada: no marca publicaciones nuevas. Podés reanudarla desde Mis alertas.</Text>}
      {!isOnline && <Text style={styles.advertencia} accessibilityRole="alert">Sin conexión. {MENSAJE_REQUIERE_CONEXION}</Text>}
      {!!error && (
        <View>
          <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
          <PrimaryButton title="Reintentar" variant="secondary" onPress={reintentar} style={styles.espacio} />
        </View>
      )}
      {mostrandoCarga && <ActivityIndicator size="large" accessibilityLabel="Cargando coincidencias" style={styles.espacio} />}
      {!mostrandoCarga && isOnline && !error && !resultados.length && (
        <Text style={styles.vacio}>Todavía no hay publicaciones que coincidan con esta alerta. Cuando aparezca una, la vas a ver en Mis alertas.</Text>
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.lista}
      contentContainerStyle={styles.contenido}
      data={resultados}
      keyExtractor={item => String(item.id)}
      renderItem={({ item }) => (
        <PublicationCard publicacion={item} novedad={item.is_new ? 'Nueva' : undefined}
          onPress={() => navigation.navigate('PublicationDetail', { publicationId: item.id })} />
      )}
      ListHeaderComponent={header}
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListFooterComponent={cargandoMas ? <ActivityIndicator accessibilityLabel="Cargando más coincidencias" style={styles.espacio} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  lista: { backgroundColor: colors.background },
  contenido: { padding: 20, paddingBottom: 140 },
  header: { marginBottom: 8 },
  titulo: { fontSize: 16, fontWeight: '700', color: colors.text },
  texto: { fontSize: 14, color: colors.muted, marginTop: 8, marginBottom: 4 },
  textoSecundario: { fontSize: 13, color: '#6B7B74', marginTop: 2 },
  advertencia: { fontSize: 14, lineHeight: 20, color: '#8A3B2E', marginTop: 12 },
  error: { fontSize: 14, lineHeight: 20, color: colors.error, marginTop: 12 },
  vacio: { fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 12 },
  espacio: { marginTop: 12 },
});
