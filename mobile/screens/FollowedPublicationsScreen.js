// Punto 9 - "Seguidas": publicaciones que la persona sigue, con su estado actual y un aviso
// cuando cambió desde la última vez que la vio. Abrir el detalle la marca como vista (lo hace
// el backend en GET /publications/:id) y al volver la lista se recarga.
// Sin conexión muestra la última lista guardada (punto 6).
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { idDeUsuario, useConnectivity } from '../context/ConnectivityContext';
import { colors } from '../config/theme';
import PrimaryButton from '../components/PrimaryButton';
import PublicationCard from '../components/search/PublicationCard';
import { getFollowedPublications } from '../services/alertService';
import { guardarLista, leerLista } from '../services/alerts/alertsCache';
import { conFotosAbsolutas } from '../services/publicationService';
import { textoCambioEstado } from '../services/search/searchCriteria';
import { getApiError } from '../services/api';

function formatearFechaHora(ms) {
  const d = new Date(ms);
  const dos = n => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export default function FollowedPublicationsScreen({ navigation }) {
  const { user } = useAuth();
  const userId = idDeUsuario(user);
  const { isOnline } = useConnectivity();
  const [seguidas, setSeguidas] = useState(null);
  const [copiaDel, setCopiaDel] = useState(null);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    const usarCopia = async () => {
      const copia = await leerLista('seguidas', userId);
      setSeguidas(copia?.datos || []);
      setCopiaDel(copia?.guardadoEn ?? 0);
    };
    if (!isOnline) { await usarCopia(); return; }
    try {
      const lista = (await getFollowedPublications()).map(conFotosAbsolutas);
      setSeguidas(lista);
      setCopiaDel(null);
      await guardarLista('seguidas', userId, lista);
    } catch (err) {
      if (!err.response) await usarCopia();
      else {
        setError(getApiError(err));
        setSeguidas(actuales => actuales || []);
      }
    }
  }, [isOnline, userId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  if (seguidas === null) return <ActivityIndicator style={styles.cargando} size="large" accessibilityLabel="Cargando publicaciones seguidas" />;

  const conCambios = seguidas.filter(p => p.has_update).length;

  const header = (
    <View style={styles.header}>
      {!!seguidas.length && (
        <Text style={styles.texto}>
          {seguidas.length} publicaci{seguidas.length === 1 ? 'ón seguida' : 'ones seguidas'}
          {conCambios ? ` · ${conCambios} con cambios de estado` : ''}
        </Text>
      )}
      {copiaDel !== null && (
        <Text style={styles.advertencia} accessibilityRole="alert">
          {copiaDel
            ? `Sin conexión. Mostramos la lista guardada el ${formatearFechaHora(copiaDel)}; los estados podrían no estar actualizados.`
            : 'Sin conexión y sin publicaciones seguidas guardadas en este dispositivo.'}
        </Text>
      )}
      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );

  const vacio = copiaDel === 0 || error ? null : (
    <View>
      <Text style={styles.vacio}>Todavía no seguís ninguna publicación. Desde el detalle de una publicación, tocá “Seguir publicación” para enterarte cuando cambie de estado.</Text>
      <PrimaryButton title="Ir al buscador" onPress={() => navigation.navigate('Search')} style={styles.espacio} />
    </View>
  );

  return (
    <FlatList
      style={styles.lista}
      contentContainerStyle={styles.contenido}
      data={seguidas}
      keyExtractor={item => String(item.id)}
      refreshing={refrescando}
      onRefresh={isOnline ? refrescar : undefined}
      ListHeaderComponent={header}
      ListEmptyComponent={vacio}
      renderItem={({ item }) => (
        <PublicationCard publicacion={item} mostrarEstado novedad={textoCambioEstado(item) || undefined}
          onPress={() => navigation.navigate('PublicationDetail', { publicationId: item.id })} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  cargando: { flex: 1 },
  lista: { backgroundColor: colors.background },
  contenido: { padding: 20, paddingBottom: 140 },
  header: { marginBottom: 12 },
  texto: { fontSize: 15, lineHeight: 22, color: colors.muted },
  advertencia: { fontSize: 14, lineHeight: 20, color: '#8A3B2E', marginTop: 12 },
  error: { fontSize: 14, lineHeight: 20, color: colors.error, marginTop: 12 },
  vacio: { fontSize: 16, lineHeight: 24, color: colors.muted, marginTop: 8 },
  espacio: { marginTop: 12 },
});
