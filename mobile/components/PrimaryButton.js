import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../config/theme';

export default function PrimaryButton({ title, onPress, variant = 'primary', busy = false, disabled = false, style }) {
  const primary = variant === 'primary';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[styles.base, primary ? styles.primary : styles.secondary, (disabled || busy) && styles.disabled, style]}
    >
      {busy
        ? <ActivityIndicator color={primary ? 'white' : colors.primary} />
        : <Text style={[styles.text, !primary && styles.secondaryText]}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, padding: 14, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  text: { color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondaryText: { color: colors.primary },
});
