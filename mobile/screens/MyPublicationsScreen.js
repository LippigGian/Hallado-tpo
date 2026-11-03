import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { getApiError } from '../services/api';
import { getMyPublications, renewPublication } from '../services/publicationService';
import { colors } from '../config/theme';
import PrimaryButton from '../components/PrimaryButton';
import PublicationCard from '../components/publication/PublicationCard';
import { idDeUsuario, useConnectivity } from '../context/ConnectivityContext';
import { useAuth } from '../context/AuthContext';
import { ESTADO_ERROR, descartarPendiente, reintentarPendiente } from '../services/offline/pendingPublications';

export default function MyPublicationsScreen({ navigation, route }) {
  const [publications, setPublications] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [renewingId, setRenewingId] = useState(null);
  const { user } = useAuth();
  const { isOnline, pendientes, ultimoEnvio, sincronizarPendientes } = useConnectivity();

  const load = useCallback(async () => {
    setError('');
    try {
      setPublications(await getMyPublications());
    } catch (loadError) {
      setError(getApiError(loadError));
      setPublications(current => current ?? []);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Punto 6: cuando se envían publicaciones pendientes, se recarga la lista del servidor.
  useEffect(() => {
    if (!ultimoEnvio) return;
    getMyPublications().then(setPublications).catch(() => {});
  }, [ultimoEnvio]);

  async function retryPending(idLocal) {
    await reintentarPendiente(idDeUsuario(user), idLocal);
    if (isOnline) await sincronizarPendientes();
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function renew(id) {
    setRenewingId(id);
    setError('');
    try {
      const renewed = await renewPublication(id);
      setPublications(current => current.map(item => (item.id === id ? renewed : item)));
    } catch (renewError) {
      setError(getApiError(renewError));
    } finally {
      setRenewingId(null);
    }
  }

  if (publications === null) return <ActivityIndicator style={styles.loading} size="large" accessibilityLabel="Cargando publicaciones" />;

  const header = (
    <View>
      {!!route.params?.justPublished && <Text style={styles.success} accessibilityLiveRegion="polite">¡Tu publicación ya está en Hallado!</Text>}
      {!!route.params?.queued && (
        <Text style={styles.success} accessibilityLiveRegion="polite">
          Guardamos tu publicación sin conexión. Se va a publicar sola cuando vuelvas a tener internet.
        </Text>
      )}
      {pendientes.length > 0 && (
        <View style={styles.pending}>
          <Text style={styles.pendingTitle}>Pendientes de envío</Text>
          {pendientes.map(item => (
            <View key={item.idLocal} style={styles.pendingItem}>
              <Text style={styles.pendingName}>{item.datos.title}</Text>
              <Text style={item.estado === ESTADO_ERROR ? styles.error : styles.pendingState}>
                {item.estado === ESTADO_ERROR ? `No se pudo publicar: ${item.ultimoError}` : 'Pendiente de envío: se publica al recuperar la conexión.'}
              </Text>
              {item.estado === ESTADO_ERROR && (
                <PrimaryButton title="Reintentar" variant="secondary" onPress={() => retryPending(item.idLocal)} style={styles.renew} />
              )}
              <PrimaryButton title="Descartar" variant="secondary" onPress={() => descartarPendiente(idDeUsuario(user), item.idLocal)} style={styles.renew} />
            </View>
          ))}
        </View>
      )}
      <PrimaryButton title="Nueva publicación" onPress={() => navigation.navigate('PublishPublication')} style={styles.newButton} />
      <PrimaryButton title="Ver reclamos recibidos" variant="secondary" onPress={() => navigation.navigate('MyClaims', { tab: 'received' })} style={styles.newButton} />
      {/* Sin conexión ya lo avisa el cartel "Sin conexión": no se muestra el error de la API. */}
      {!!error && isOnline && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={publications}
      keyExtractor={item => item.id}
      refreshing={refreshing}
      onRefresh={refresh}
      ListHeaderComponent={header}
      ListEmptyComponent={error ? null : <Text style={styles.empty}>Todavía no publicaste nada. Las publicaciones vencen a los 30 días y podés renovarlas.</Text>}
      renderItem={({ item }) => (
        <PublicationCard
          publication={item}
          onPress={() => navigation.navigate('PublicationDetail', { publicationId: item.id })}
        >
          {(item.status === 'open' || item.status === 'expired') && (
            <PrimaryButton
              title="Renovar por 30 días"
              variant="secondary"
              busy={renewingId === item.id}
              disabled={renewingId !== null}
              onPress={() => renew(item.id)}
              style={styles.renew}
            />
          )}
        </PublicationCard>
      )}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  list: { backgroundColor: colors.background },
  content: { padding: 24 },
  newButton: { marginBottom: 16 },
  success: { fontSize: 16, fontWeight: '600', color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 10, padding: 12, marginBottom: 16 },
  error: { fontSize: 15, lineHeight: 22, color: colors.error, marginBottom: 12 },
  empty: { fontSize: 16, lineHeight: 24, color: colors.muted, marginTop: 8 },
  renew: { marginTop: 12 },
  pending: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: colors.primarySoft, padding: 16, marginBottom: 16 },
  pendingTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 8 },
  pendingItem: { paddingVertical: 8 },
  pendingName: { fontSize: 16, fontWeight: '600', color: colors.text },
  pendingState: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 2 },
});
