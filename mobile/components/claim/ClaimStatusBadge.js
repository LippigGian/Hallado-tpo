import { StyleSheet, Text } from 'react-native';
import { colors } from '../../config/theme';
import { CLAIM_STATUS_LABELS } from '../../config/claimOptions';

const STATUS_COLORS = {
  pending: colors.warning,
  accepted: colors.primary,
  rejected: colors.error,
  expired: colors.muted,
};

export default function ClaimStatusBadge({ status }) {
  return <Text style={[styles.badge, { color: STATUS_COLORS[status] }]}>{CLAIM_STATUS_LABELS[status] ?? status}</Text>;
}

const styles = StyleSheet.create({
  badge: { fontSize: 15, fontWeight: '700' },
});
