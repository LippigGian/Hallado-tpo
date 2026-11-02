import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getApiError } from '../services/api';
import { getPublication } from '../services/publicationService';
import { createClaim } from '../services/claimService';
import { colors } from '../config/theme';
import { CLAIM_ACTION_LABELS, CLAIM_LIMITS, claimKindFor, isClaimable } from '../config/claimOptions';
import { buildClaimPayload, emptyClaimForm, validateClaimForm } from '../utils/claimValidation';
import { PhotoReadError } from '../utils/photos';
import ConnectionRequiredButton from '../components/offline/ConnectionRequiredButton';
import DetailRow from '../components/DetailRow';
import FormField from '../components/FormField';
import PhotoPicker from '../components/PhotoPicker';
import PrimaryButton from '../components/PrimaryButton';

export default function CreateClaimScreen({ navigation, route }) {
  const { publicationId } = route.params;
  const [publication, setPublication] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(emptyClaimForm);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const loadPublication = useCallback(async () => {
    setLoadError('');
    try {
      setPublication(await getPublication(publicationId));
    } catch (error) {
      setLoadError(getApiError(error));
    }
  }, [publicationId]);

  useEffect(() => { loadPublication(); }, [loadPublication]);

  const updateForm = changes => setForm(current => ({ ...current, ...changes }));

  if (!publication) {
    return loadError
      ? <View style={styles.container}><Text style={styles.error}>{loadError}</Text><PrimaryButton title="Reintentar" onPress={loadPublication} /></View>
      : <ActivityIndicator style={styles.loading} size="large" accessibilityLabel="Cargando publicación" />;
  }

  if (!isClaimable(publication)) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{publication.title}</Text>
        <Text style={styles.text}>
          {publication.is_owner ? 'No podés reclamar tu propia publicación.' : 'Esta publicación ya no admite reclamos.'}
        </Text>
      </View>
    );
  }

  const kind = claimKindFor(publication.type);

  async function send() {
    const message = validateClaimForm(kind, form);
    if (message) return setError(message);
    setSending(true);
    setError('');
    try {
      const claim = await createClaim(buildClaimPayload(publication.id, kind, form));
      navigation.replace('ClaimDetail', { claimId: claim.id });
    } catch (sendError) {
      setError(sendError instanceof PhotoReadError ? sendError.message : getApiError(sendError));
      setSending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.kind}>{CLAIM_ACTION_LABELS[kind]}</Text>
      <Text style={styles.title}>{publication.title}</Text>
      <Text style={styles.text}>
        Tenés hasta {CLAIM_LIMITS.maxAttempts} intentos por publicación y quien publicó tiene {CLAIM_LIMITS.hoursToExpire} horas para responder.
      </Text>

      {kind === 'owner' ? (
        <View>
          <DetailRow label="Pregunta de verificación" value={publication.verification_question} />
          <FormField
            label="Tu respuesta"
            maxLength={CLAIM_LIMITS.answer[1]}
            value={form.verification_answer}
            onChangeText={verification_answer => updateForm({ verification_answer })}
          />
          <FormField
            label="Descripción (opcional)"
            hint="Contá cualquier detalle que acredite que es tuyo."
            multiline
            maxLength={CLAIM_LIMITS.descriptionMax}
            value={form.description}
            onChangeText={description => updateForm({ description })}
          />
          <Text style={styles.label}>Foto que acredite que es tuyo (opcional)</Text>
          <PhotoPicker photos={form.photos} onChange={photos => updateForm({ photos })} max={1} />
        </View>
      ) : (
        <View>
          <Text style={styles.label}>Foto del objeto que encontraste</Text>
          <PhotoPicker photos={form.photos} onChange={photos => updateForm({ photos })} max={1} />
          <FormField
            label="Barrio donde lo encontraste"
            maxLength={CLAIM_LIMITS.neighborhood[1]}
            value={form.found_neighborhood}
            onChangeText={found_neighborhood => updateForm({ found_neighborhood })}
          />
          <FormField
            label="Descripción (opcional)"
            multiline
            maxLength={CLAIM_LIMITS.descriptionMax}
            value={form.description}
            onChangeText={description => updateForm({ description })}
          />
        </View>
      )}

      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
      <ConnectionRequiredButton titulo={sending ? 'Enviando…' : 'Enviar reclamo'} disabled={sending} onPress={send} style={styles.submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  container: { flexGrow: 1, padding: 24, backgroundColor: colors.background },
  kind: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 8 },
  text: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 },
  error: { fontSize: 15, lineHeight: 22, color: colors.error, marginVertical: 12 },
  submit: { marginTop: 8 },
});
