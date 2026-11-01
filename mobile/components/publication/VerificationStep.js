import { StyleSheet, Text, View } from 'react-native';
import FormField from '../FormField';
import { colors } from '../../config/theme';
import { LIMITS } from '../../config/publicationOptions';

// Paso 5 (solo hallazgos): pregunta sobre un detalle que no se vea en las fotos y su respuesta privada.
export default function VerificationStep({ form, onChange }) {
  return (
    <View>
      <Text style={styles.text}>
        Quien diga que el objeto es suyo tendrá que responder esta pregunta. Elegí un detalle que no se vea en las fotos.
      </Text>
      <FormField
        label="Pregunta"
        placeholder="Ej.: ¿De qué color es el llavero?"
        maxLength={LIMITS.question[1]}
        value={form.verification_question}
        onChangeText={verification_question => onChange({ verification_question })}
      />
      <FormField
        label="Respuesta"
        placeholder="Ej.: Azul"
        hint="La respuesta es privada: solo vos la vas a ver."
        maxLength={LIMITS.answer[1]}
        value={form.verification_answer}
        onChangeText={verification_answer => onChange({ verification_answer })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 16, lineHeight: 24, color: colors.muted, marginBottom: 16 },
});
