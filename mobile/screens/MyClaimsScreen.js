import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useMyClaims } from '../hooks/useMyClaims';
import { colors } from '../config/theme';
import { CLAIM_TABS } from '../config/claimOptions';
import ChoiceChips from '../components/ChoiceChips';
import ClaimCard from '../components/claim/ClaimCard';

const EMPTY_MESSAGES = {
  sent: 'Todavía no enviaste ningún reclamo.',
  received: 'Todavía no recibiste reclamos sobre tus publicaciones.',
};

export default function MyClaimsScreen({ navigation, route }) {
  const [tab, setTab] = useState(route.params?.tab ?? 'sent');
  const { claims, error, refreshing, refresh } = useMyClaims();

  if (claims === null) return <ActivityIndicator style={styles.loading} size="large" accessibilityLabel="Cargando reclamos" />;

  const tabs = CLAIM_TABS.map(item => ({ ...item, label: `${item.label} (${claims[item.value].length})` }));

  const header = (
    <View style={styles.header}>
      <ChoiceChips options={tabs} value={tab} onChange={setTab} />
      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={claims[tab]}
      keyExtractor={item => item.id}
      refreshing={refreshing}
      onRefresh={refresh}
      ListHeaderComponent={header}
      ListEmptyComponent={error ? null : <Text style={styles.empty}>{EMPTY_MESSAGES[tab]}</Text>}
      renderItem={({ item }) => <ClaimCard claim={item} onPress={() => navigation.navigate('ClaimDetail', { claimId: item.id })} />}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  list: { backgroundColor: colors.background },
  content: { padding: 24 },
  header: { marginBottom: 16 },
  error: { fontSize: 15, lineHeight: 22, color: colors.error, marginTop: 12 },
  empty: { fontSize: 16, lineHeight: 24, color: colors.muted, marginTop: 8 },
});
