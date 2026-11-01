import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../config/theme';

// Lista de opciones de selección única (por ejemplo, las categorías). `options` = [{ value, label }].
export default function ChoiceChips({ options, value, onChange }) {
  return (
    <View style={styles.row}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.selected]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.text, selected && styles.selectedText]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 22,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: 15, color: colors.text, fontWeight: '600' },
  selectedText: { color: 'white' },
});
