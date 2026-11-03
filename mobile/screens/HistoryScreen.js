// Punto 10 - Historial: casos resueltos en dos pestañas ("Devolví" y "Recuperé"), con filtros
// por período (opciones predeterminadas que el backend convierte en fechas) y por categoría.
// Desde cada caso se valora a la otra parte o se deja un agradecimiento (7 días).
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useConnectivity } from '../context/ConnectivityContext';
import { colors } from '../config/theme';
import { CATEGORIES } from '../config/publicationOptions';
import ChoiceChips from '../components/ChoiceChips';
import HistoryCard from '../components/history/HistoryCard';
import { MENSAJE_REQUIERE_CONEXION } from '../components/offline/ConnectionRequiredButton';
import { getHistory } from '../services/historyService';
import { getApiError } from '../services/api';
import { PERIODOS_HISTORIAL, PESTANIAS_HISTORIAL } from '../services/history/historyView';

const CATEGORIAS = [{ value: 'todas', label: 'Todas' }, ...CATEGORIES];

const VACIO = {
  returned: 'No hay devoluciones tuyas con estos filtros.',
  recovered: 'No hay objetos recuperados con estos filtros.',
};

export default function HistoryScreen({ navigation }) {
  const { isOnline } = useConnectivity();
  const [pestania, setPestania] = useState('returned');
  const [periodo, setPeriodo] = useState('todo');
  const [categoria, setCategoria] = useState('todas');
  const [historial, setHistorial] = useState(null);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    if (!isOnline) {
      setError(MENSAJE_REQUIERE_CONEXION);
      setHistorial(actual => actual || { returned: [], recovered: [] });
      return;
    }
    try {
      setHistorial(await getHistory({ period: periodo, category: categoria === 'todas' ? null : categoria }));
      setError('');
    } catch (err) {
      setError(getApiError(err));
      setHistorial(actual => actual || { returned: [], recovered: [] });
    }
  }, [isOnline, periodo, categoria]);

  // Se recarga al volver del formulario de valoración y al cambiar un filtro.
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  if (historial === null) return <ActivityIndicator style={styles.loading} size="large" accessibilityLabel="Cargando historial" />;

  const pestanias = PESTANIAS_HISTORIAL.map(item => ({ ...item, label: `${item.label} (${historial[item.value].length})` }));

  const header = (
    <View style={styles.header}>
      <ChoiceChips options={pestanias} value={pestania} onChange={setPestania} />
      <Text style={styles.filterLabel}>Período</Text>
      <ChoiceChips options={PERIODOS_HISTORIAL} value={periodo} onChange={setPeriodo} />
      <Text style={styles.filterLabel}>Categoría</Text>
      <ChoiceChips options={CATEGORIAS} value={categoria} onChange={setCategoria} />
      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );

  const abrirFormulario = (caso, tipo) => navigation.navigate('HistoryFeedback', {
    tipo,
    returnId: caso.id,
    titulo: caso.publication.title,
    contraparte: caso.counterpart.name,
  });

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={historial[pestania]}
      keyExtractor={item => item.id}
      refreshing={refrescando}
      onRefresh={refrescar}
      ListHeaderComponent={header}
      ListEmptyComponent={error ? null : <Text style={styles.empty}>{VACIO[pestania]}</Text>}
      renderItem={({ item }) => (
        <HistoryCard
          caso={item}
          pestania={pestania}
          onOpenProfile={() => navigation.navigate('PublicProfile', { userId: item.counterpart.id })}
          onRate={() => abrirFormulario(item, 'rating')}
          onThank={() => abrirFormulario(item, 'thanks')}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  list: { backgroundColor: colors.background },
  content: { padding: 24 },
  header: { marginBottom: 16 },
  filterLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 8 },
  error: { fontSize: 15, lineHeight: 22, color: colors.error, marginTop: 12 },
  empty: { fontSize: 16, lineHeight: 24, color: colors.muted, marginTop: 8 },
});
