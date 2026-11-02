import { StyleSheet, Text, View } from 'react-native';
import FormField from '../FormField';
import ChoiceChips from '../ChoiceChips';
import { colors } from '../../config/theme';
import { CATEGORIES, LIMITS } from '../../config/publicationOptions';
import { maskDate, maskTime } from '../../utils/dateTime';

export default function DetailsStep({ form, onChange }) {
  return (
    <View>
      <FormField
        label="Título"
        placeholder="Ej.: Llaves con llavero azul"
        maxLength={LIMITS.title[1]}
        value={form.title}
        onChangeText={title => onChange({ title })}
      />
      <FormField
        label="Descripción"
        placeholder="Contá cómo es, marcas, señas particulares…"
        multiline
        maxLength={LIMITS.description[1]}
        value={form.description}
        onChangeText={description => onChange({ description })}
      />
      <Text style={styles.label}>Categoría</Text>
      <ChoiceChips options={CATEGORIES} value={form.category} onChange={category => onChange({ category })} />
      <Text style={[styles.label, styles.dateLabel]}>¿Cuándo fue?</Text>
      <View style={styles.row}>
        <View style={styles.dateColumn}>
          <FormField
            label="Fecha"
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            maxLength={10}
            value={form.date}
            onChangeText={text => onChange({ date: maskDate(text) })}
          />
        </View>
        <View style={styles.timeColumn}>
          <FormField
            label="Hora"
            placeholder="HH:MM"
            keyboardType="number-pad"
            maxLength={5}
            value={form.time}
            onChangeText={text => onChange({ time: maskTime(text) })}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 },
  dateLabel: { marginTop: 20 },
  row: { flexDirection: 'row', gap: 12 },
  dateColumn: { flex: 3 },
  timeColumn: { flex: 2 },
});
