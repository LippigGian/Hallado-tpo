import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../config/theme';
import { PUBLICATION_TYPES } from '../../config/publicationOptions';

// Paso 1: perdí / encontré.
export default function TypeStep({ form, onChange }) {
  return (
    <View>
      {PUBLICATION_TYPES.map(type => {
        const selected = form.type === type.value;
        return (
          <TouchableOpacity
            key={type.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.card, selected && styles.selected]}
            onPress={() => onChange({ type: type.value })}
          >
            <Text style={[styles.title, selected && styles.selectedText]}>{type.label}</Text>
            <Text style={[styles.description, selected && styles.selectedText]}>{type.description}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 12 },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  description: { fontSize: 15, lineHeight: 22, color: colors.muted },
  selectedText: { color: 'white' },
});
