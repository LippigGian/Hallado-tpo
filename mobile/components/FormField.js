import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../config/theme';

export default function FormField({ label, hint, multiline = false, ...inputProps }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={colors.muted}
        {...inputProps}
      />
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: {
    minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12,
    backgroundColor: colors.surface, fontSize: 16, color: colors.text,
  },
  multiline: { minHeight: 110 },
  hint: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 6 },
});
