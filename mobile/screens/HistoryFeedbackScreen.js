// Punto 10 - Valorar a la otra parte (positiva o negativa, mensaje opcional) o dejar un
// agradecimiento público (solo quien recuperó). Se envía una sola vez y no se puede editar.
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '../config/theme';
import ChoiceChips from '../components/ChoiceChips';
import FormField from '../components/FormField';
import ConnectionRequiredButton from '../components/offline/ConnectionRequiredButton';
import { rateCase, thankCase } from '../services/historyService';
import { getApiError } from '../services/api';
import { MENSAJE_MAXIMO, validarAgradecimiento, validarValoracion } from '../services/history/historyView';

const VALORES = [
  { value: 'positive', label: '👍 Positiva' },
  { value: 'negative', label: '👎 Negativa' },
];

export default function HistoryFeedbackScreen({ navigation, route }) {
  const { tipo, returnId, titulo, contraparte } = route.params;
  const esValoracion = tipo === 'rating';
  const [valor, setValor] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const { error: invalido, value } = esValoracion ? validarValoracion({ valor, mensaje }) : validarAgradecimiento({ mensaje });
    if (invalido) { setError(invalido); return; }
    setEnviando(true);
    setError('');
    try {
      await (esValoracion ? rateCase(returnId, value) : thankCase(returnId, value));
      Alert.alert(
        esValoracion ? 'Valoración enviada' : 'Agradecimiento enviado',
        esValoracion ? `Tu valoración suma a la reputación de ${contraparte}.` : `Tu agradecimiento queda visible en el perfil de ${contraparte}.`,
      );
      navigation.goBack();
    } catch (err) {
      setError(getApiError(err));
      setEnviando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{esValoracion ? `Valorar a ${contraparte}` : `Agradecer a ${contraparte}`}</Text>
      <Text style={styles.text}>Caso: {titulo}</Text>
      <Text style={styles.text}>
        {esValoracion
          ? 'Contá cómo fue la devolución. Se envía una sola vez y no se puede modificar.'
          : 'Tu agradecimiento va a ser público en su perfil. Se envía una sola vez.'}
      </Text>

      {esValoracion && <ChoiceChips options={VALORES} value={valor} onChange={setValor} />}

      <FormField
        label={esValoracion ? 'Mensaje (opcional)' : 'Tu agradecimiento'}
        hint={`${mensaje.length}/${MENSAJE_MAXIMO} caracteres`}
        value={mensaje}
        onChangeText={setMensaje}
        maxLength={MENSAJE_MAXIMO}
        multiline
        placeholder={esValoracion ? 'Por ejemplo: fue muy puntual.' : '¡Gracias por devolverme mis llaves!'}
      />

      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}

      <ConnectionRequiredButton titulo={enviando ? 'Enviando…' : 'Enviar'} disabled={enviando} onPress={enviar} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: colors.background, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  text: { fontSize: 15, lineHeight: 22, color: colors.muted },
  error: { fontSize: 15, lineHeight: 22, color: colors.error },
});
