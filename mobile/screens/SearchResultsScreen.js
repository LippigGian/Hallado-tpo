// Punto 3 - Buscador inicial y resultados: listado paginado, con refinar filtros, orden
// y modo sin conexión (integrado con mobile/services/offline/offlineCache.js).
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { idDeUsuario, useConnectivity } from '../context/ConnectivityContext';
import SearchFilters from '../components/search/SearchFilters';
import PublicationCard from '../components/search/PublicationCard';
import { criteriosAParams, describirBusqueda, validarCriterios } from '../services/search/searchCriteria';
import { puntoDeReferencia } from '../services/search/neighborhoods';
import { conFotosAbsolutas, searchPublications } from '../services/publicationService';
import { guardarComoAlerta, registrarBusqueda } from '../services/search/recentSearches';
import { getApiError } from '../services/api';
import { guardarResultadosBusqueda, obtenerResultadosGuardados } from '../services/offline/offlineCache';

function formatearFechaHora(ms) {
  const d = new Date(ms);
  const dos = n => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export default function SearchResultsScreen({ route, navigation }) {
  const { user } = useAuth();
  const userId = idDeUsuario(user);
  const { isOnline } = useConnectivity();
  const [criterios, setCriterios] = useState(route.params.criterios);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [borrador, setBorrador] = useState(route.params.criterios);
  const [errores, setErrores] = useState({});
  const [resultados, setResultados] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');
  const [offlineInfo, setOfflineInfo] = useState(null);
  const [avisoAlerta, setAvisoAlerta] = useState('');

  const cargar = useCallback(async (criteriosAUsar, pag, acumulado) => {
    if (pag === 1) setCargando(true); else setCargandoMas(true);
    setError('');
    const usarCache = async () => {
      const guardado = await obtenerResultadosGuardados(criteriosAUsar);
      if (guardado) {
        setResultados(guardado.resultados);
        setOfflineInfo({ guardadoEn: guardado.guardadoEn, coincide: guardado.coincideConBusqueda });
      } else {
        setResultados([]);
        setOfflineInfo({ vacio: true });
      }
      setHasMore(false);
    };
    try {
      if (!isOnline) { await usarCache(); return; }
      const params = criteriosAParams(criteriosAUsar, { pagina: pag, referencia: puntoDeReferencia(criteriosAUsar) });
      const respuesta = await searchPublications(params);
      const nuevos = respuesta.results.map(conFotosAbsolutas);
      const todos = pag === 1 ? nuevos : [...acumulado, ...nuevos];
      setResultados(todos);
      setHasMore(respuesta.has_more);
      setTotal(respuesta.total);
      setPagina(pag);
      setOfflineInfo(null);
      await guardarResultadosBusqueda(criteriosAUsar, todos);
    } catch (err) {
      if (!err.response) await usarCache();
      else setError(getApiError(err));
    } finally {
      setCargando(false);
      setCargandoMas(false);
    }
  }, [isOnline]);

  useEffect(() => { cargar(criterios, 1, []); }, [criterios, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  async function aplicarRefinar() {
    const erroresEncontrados = validarCriterios(borrador);
    if (Object.keys(erroresEncontrados).length) { setErrores(erroresEncontrados); return; }
    setErrores({});
    await registrarBusqueda(userId, borrador);
    setMostrarFiltros(false);
    setCriterios(borrador);
    navigation.setParams({ criterios: borrador });
  }

  function cambiarOrden(orden) {
    const nuevos = { ...criterios, orden };
    setBorrador(nuevos);
    registrarBusqueda(userId, nuevos);
    setCriterios(nuevos);
    navigation.setParams({ criterios: nuevos });
  }

  function cargarMas() {
    if (!hasMore || cargandoMas || cargando || !isOnline) return;
    cargar(criterios, pagina + 1, resultados);
  }

  async function guardarBusquedaComoAlerta() {
    await guardarComoAlerta(userId, criterios);
    setAvisoAlerta('Guardamos esta búsqueda en Alertas guardadas de este dispositivo. Los avisos automáticos llegan con el módulo de alertas.');
  }

  function publicarDesdeVacio() {
    navigation.navigate('Publish', { tipo: criterios.queTePaso === 'perdi' ? 'lost' : 'found', categoria: criterios.categoria, barrio: criterios.barrio });
  }

  const referencia = puntoDeReferencia(criterios);
  const puedeOrdenarPorCercania = Boolean(referencia);

  const header = (
    <View>
      <Text style={styles.resumen}>{describirBusqueda(criterios)}</Text>
      {!cargando && isOnline && <Text style={styles.total}>{total} resultado{total === 1 ? '' : 's'}</Text>}

      <View style={styles.fila}>
        <TouchableOpacity style={[styles.chipOrden, criterios.orden !== 'cercanos' && styles.chipOrdenActivo]} accessibilityRole="button" accessibilityState={{ selected: criterios.orden !== 'cercanos' }} onPress={() => cambiarOrden('recientes')}>
          <Text style={[styles.chipOrdenTexto, criterios.orden !== 'cercanos' && styles.chipOrdenTextoActivo]}>Más recientes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chipOrden, criterios.orden === 'cercanos' && styles.chipOrdenActivo, !puedeOrdenarPorCercania && styles.chipDeshabilitado]}
          accessibilityRole="button" accessibilityState={{ selected: criterios.orden === 'cercanos', disabled: !puedeOrdenarPorCercania }}
          disabled={!puedeOrdenarPorCercania} onPress={() => cambiarOrden('cercanos')}>
          <Text style={[styles.chipOrdenTexto, criterios.orden === 'cercanos' && styles.chipOrdenTextoActivo]}>Más cercanos</Text>
        </TouchableOpacity>
      </View>
      {!puedeOrdenarPorCercania && <Text style={styles.hint}>Elegí un barrio o usá tu ubicación para ordenar por cercanía.</Text>}

      <TouchableOpacity style={styles.botonSecundario} accessibilityRole="button" onPress={() => { setBorrador(criterios); setMostrarFiltros(v => !v); }}>
        <Text style={styles.botonSecundarioTexto}>{mostrarFiltros ? 'Ocultar filtros' : 'Refinar filtros'}</Text>
      </TouchableOpacity>
      {mostrarFiltros && (
        <View style={styles.panelFiltros}>
          <SearchFilters valor={borrador} onChange={parcial => setBorrador(c => ({ ...c, ...parcial }))} errores={errores} permitirTodos />
          <TouchableOpacity style={styles.boton} accessibilityRole="button" onPress={aplicarRefinar}>
            <Text style={styles.botonTexto}>Aplicar</Text>
          </TouchableOpacity>
        </View>
      )}

      {offlineInfo && !offlineInfo.vacio && (
        <Text style={styles.advertencia} accessibilityRole="alert">
          Sin conexión. Mostramos resultados guardados el {formatearFechaHora(offlineInfo.guardadoEn)}; la información podría no estar actualizada.
          {!offlineInfo.coincide ? ' Corresponden a tu última búsqueda, no a esta.' : ''}
        </Text>
      )}
      {offlineInfo?.vacio && <Text style={styles.advertencia} accessibilityRole="alert">Sin conexión y sin resultados guardados.</Text>}

      {!!error && (
        <View>
          <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
          <TouchableOpacity style={styles.botonSecundario} accessibilityRole="button" onPress={() => cargar(criterios, 1, [])}>
            <Text style={styles.botonSecundarioTexto}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {cargando && <ActivityIndicator size="large" accessibilityLabel="Buscando publicaciones" style={styles.espacio} />}

      {!cargando && isOnline && !error && resultados.length === 0 && (
        <View style={styles.sinResultados}>
          <Text style={styles.texto}>No encontramos publicaciones con estos filtros.</Text>
          <Text style={styles.texto}>Probá ampliar el barrio o el rango de fechas, o quitar las palabras clave.</Text>
          <TouchableOpacity style={[styles.boton, styles.espacio]} accessibilityRole="button" onPress={publicarDesdeVacio}>
            <Text style={styles.botonTexto}>{criterios.queTePaso === 'perdi' ? 'Publicar mi pérdida' : 'Publicar mi hallazgo'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonSecundario} accessibilityRole="button" onPress={guardarBusquedaComoAlerta}>
            <Text style={styles.botonSecundarioTexto}>Guardar búsqueda como alerta</Text>
          </TouchableOpacity>
          {!!avisoAlerta && <Text style={styles.aviso} accessibilityLiveRegion="polite">{avisoAlerta}</Text>}
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      contentContainerStyle={styles.contenedor}
      data={resultados}
      keyExtractor={item => String(item.id)}
      renderItem={({ item }) => <PublicationCard publicacion={item} />}
      ListHeaderComponent={header}
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListFooterComponent={cargandoMas ? <ActivityIndicator accessibilityLabel="Cargando más resultados" style={styles.espacio} /> : null}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  contenedor: { padding: 20, paddingBottom: 140, backgroundColor: '#F6F8F7' },
  resumen: { fontSize: 16, fontWeight: '700', color: '#173F35' },
  total: { fontSize: 14, color: '#52635B', marginTop: 2, marginBottom: 10 },
  fila: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chipOrden: { borderWidth: 1, borderColor: '#205B46', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipOrdenActivo: { backgroundColor: '#205B46' },
  chipDeshabilitado: { borderColor: '#D5DDD9' },
  chipOrdenTexto: { color: '#205B46', fontSize: 13, fontWeight: '600' },
  chipOrdenTextoActivo: { color: 'white' },
  hint: { fontSize: 12, color: '#6B7B74', marginTop: 4 },
  botonSecundario: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: '#205B46', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  botonSecundarioTexto: { color: '#205B46', fontSize: 15, fontWeight: '600' },
  panelFiltros: { backgroundColor: 'white', borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#E1E7E4' },
  boton: { backgroundColor: '#205B46', minHeight: 52, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  botonTexto: { color: 'white', fontSize: 16, fontWeight: '600' },
  advertencia: { fontSize: 14, lineHeight: 20, color: '#8A3B2E', marginTop: 12 },
  error: { fontSize: 14, lineHeight: 20, color: '#A32929', marginTop: 12 },
  espacio: { marginTop: 12 },
  sinResultados: { marginTop: 16 },
  texto: { fontSize: 15, lineHeight: 22, color: '#52635B', marginBottom: 4 },
  aviso: { fontSize: 13, color: '#205B46', marginTop: 8 },
});
