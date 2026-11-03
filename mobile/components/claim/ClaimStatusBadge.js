import { StyleSheet, Text } from 'react-native';
import { colors } from '../../config/theme';
import { CLAIM_STATUS_LABELS } from '../../config/claimOptions';

const STATUS_COLORS = {
  pending: colors.warning,
  accepted: colors.primary,
  rejected: colors.error,
  expired: colors.muted,
};

// returned: el reclamo aceptado ya tiene la devolución confirmada (punto 10).
export default function ClaimStatusBadge({ status, returned = false }) {
  const label = returned ? 'Devuelto' : (CLAIM_STATUS_LABELS[status] ?? status);
  return <Text style={[styles.badge, { color: returned ? colors.primary : STATUS_COLORS[status] }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  badge: { fontSize: 15, fontWeight: '700' },
});
