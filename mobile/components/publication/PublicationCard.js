import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../config/theme';
import { CATEGORIES, PUBLICATION_TYPES, STATUS_LABELS, labelOf } from '../../config/publicationOptions';
import { apiUrl } from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/dateTime';

const STATUS_COLORS = {
  open: colors.primary,
  claimed: colors.warning,
  resolved: colors.muted,
  expired: colors.error,
};

// Tarjeta de una publicación (la respuesta de la API ya serializada).
// Se reutiliza en "Mis publicaciones" y puede usarse en resultados de búsqueda y alertas.
// `onPress` es opcional; `children` se muestra al pie (por ejemplo, botones de acción).
export default function PublicationCard({ publication, onPress, children }) {
  const cover = publication.photos[0] ? apiUrl(publication.photos[0].url) : null;
  const expiryLabel = publication.status === 'expired' ? 'Venció el' : 'Vence el';
  const showExpiry = publication.status === 'open' || publication.status === 'expired';
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container style={styles.card} {...(onPress ? { onPress, accessibilityRole: 'button' } : {})}>
      <View style={styles.row}>
        {cover
          ? <Image source={{ uri: cover }} style={styles.cover} accessibilityLabel={`Foto de ${publication.title}`} />
          : <View style={[styles.cover, styles.noCover]} />}
        <View style={styles.info}>
          <Text style={styles.type}>{labelOf(PUBLICATION_TYPES, publication.type)}</Text>
          <Text style={styles.title} numberOfLines={2}>{publication.title}</Text>
          <Text style={styles.text}>{labelOf(CATEGORIES, publication.category)} · {publication.neighborhood}</Text>
          <Text style={styles.text}>{formatDateTime(new Date(publication.occurred_at))}</Text>
        </View>
      </View>
      <Text style={[styles.status, { color: STATUS_COLORS[publication.status] }]}>
        {STATUS_LABELS[publication.status] ?? publication.status}
        {showExpiry ? ` · ${expiryLabel} ${formatDate(new Date(publication.expires_at))}` : ''}
      </Text>
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.primarySoft },
  row: { flexDirection: 'row', gap: 12 },
  cover: { width: 84, height: 84, borderRadius: 10, backgroundColor: colors.primarySoft },
  noCover: { opacity: 0.6 },
  info: { flex: 1 },
  type: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  text: { fontSize: 14, lineHeight: 20, color: colors.muted },
  status: { fontSize: 15, fontWeight: '700', marginTop: 12 },
});
