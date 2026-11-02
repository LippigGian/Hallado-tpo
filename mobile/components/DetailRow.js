import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../config/theme';

export default function DetailRow({ label, value, valueStyle }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '700', color: colors.muted, marginBottom: 2 },
  value: { fontSize: 16, lineHeight: 24, color: colors.text },
});
