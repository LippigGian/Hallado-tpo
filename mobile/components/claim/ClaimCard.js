import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../config/theme';
import { CLAIM_ACTION_LABELS } from '../../config/claimOptions';
import { apiUrl } from '../../services/api';
import { formatDateTime } from '../../utils/dateTime';
import ClaimStatusBadge from './ClaimStatusBadge';

function counterpartLabel(claim) {
  return claim.role === 'claimant' ? `Publicó ${claim.publisher.name}` : `Reclama ${claim.claimant.name}`;
}

export default function ClaimCard({ claim, onPress }) {
  const cover = apiUrl(claim.publication.cover_photo_url);
  return (
    <TouchableOpacity style={styles.card} accessibilityRole="button" onPress={onPress}>
      <View style={styles.row}>
        {cover
          ? <Image source={{ uri: cover }} style={styles.cover} accessibilityLabel={`Foto de ${claim.publication.title}`} />
          : <View style={[styles.cover, styles.noCover]} />}
        <View style={styles.info}>
          <Text style={styles.kind}>{CLAIM_ACTION_LABELS[claim.kind]}</Text>
          <Text style={styles.title} numberOfLines={2}>{claim.publication.title}</Text>
          <Text style={styles.text}>{counterpartLabel(claim)}</Text>
          <Text style={styles.text}>Enviado el {formatDateTime(new Date(claim.created_at))}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <ClaimStatusBadge status={claim.status} returned={!!claim.return?.returned} />
        {claim.status === 'pending' && <Text style={styles.text}>Vence el {formatDateTime(new Date(claim.expires_at))}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.primarySoft },
  row: { flexDirection: 'row', gap: 12 },
  cover: { width: 84, height: 84, borderRadius: 10, backgroundColor: colors.primarySoft },
  noCover: { opacity: 0.6 },
  info: { flex: 1 },
  kind: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  text: { fontSize: 14, lineHeight: 20, color: colors.muted },
  footer: { marginTop: 12, gap: 2 },
});
