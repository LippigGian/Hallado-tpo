import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '../config/theme';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export default function ClaimDemoScreen({ navigation }) {
  const [publicationId, setPublicationId] = useState('');
  const [error, setError] = useState('');

  function openClaim() {
    const id = publicationId.trim();
    if (!UUID.test(id)) return setError('Ingresá el identificador de una publicación (formato UUID).');
    setError('');
    navigation.navigate('CreateClaim', { publicationId: id });
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Reclamar (prueba)</Text>
      <Text style={styles.text}>
        Hasta que exista el detalle de la publicación, pegá acá el identificador de una publicación de otra cuenta para probar el reclamo.
      </Text>
      <FormField
        label="Identificador de la publicación"
        autoCapitalize="none"
        autoCorrect={false}
        value={publicationId}
        onChangeText={setPublicationId}
      />
      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
      <PrimaryButton title="Reclamar" onPress={openClaim} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 12 },
  text: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 20 },
  error: { fontSize: 15, lineHeight: 22, color: colors.error, marginBottom: 12 },
});
