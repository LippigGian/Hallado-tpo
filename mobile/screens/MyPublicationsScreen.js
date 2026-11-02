import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { getApiError } from '../services/api';
import { getMyPublications, renewPublication } from '../services/publicationService';
import { colors } from '../config/theme';
import PrimaryButton from '../components/PrimaryButton';
import PublicationCard from '../components/publication/PublicationCard';

export default function MyPublicationsScreen({ navigation, route }) {
  const [publications, setPublications] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [renewingId, setRenewingId] = useState(null);

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
      <PrimaryButton title="Nueva publicación" onPress={() => navigation.navigate('PublishPublication')} style={styles.newButton} />
      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
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
        <PublicationCard publication={item}>
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
});
