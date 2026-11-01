import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePublicationDraft } from '../hooks/usePublicationDraft';
import { getApiError } from '../services/api';
import { createPublication } from '../services/publicationService';
import { colors } from '../config/theme';
import { STEP_TITLES, stepsFor } from '../config/publicationOptions';
import { buildPayload, validateStep } from '../utils/publicationValidation';
import { PhotoReadError } from '../utils/photos';
import PrimaryButton from '../components/PrimaryButton';
import TypeStep from '../components/publication/TypeStep';
import PhotosStep from '../components/publication/PhotosStep';
import DetailsStep from '../components/publication/DetailsStep';
import LocationStep from '../components/publication/LocationStep';
import VerificationStep from '../components/publication/VerificationStep';

const STEP_COMPONENTS = {
  type: TypeStep,
  photos: PhotosStep,
  details: DetailsStep,
  location: LocationStep,
  verification: VerificationStep,
};

// Punto 5: carga guiada en pasos. El formulario se guarda solo como borrador (usePublicationDraft).
export default function PublishPublicationScreen({ navigation }) {
  const { user } = useAuth();
  const draft = usePublicationDraft(user.id);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);

  if (draft.loading) return <ActivityIndicator style={styles.loading} size="large" accessibilityLabel="Cargando borrador" />;

  const { form, step } = draft;
  const steps = stepsFor(form.type);
  const stepId = steps[step];
  const StepComponent = STEP_COMPONENTS[stepId];
  const isLastStep = step === steps.length - 1;

  function goTo(nextStep) {
    setError('');
    draft.setStep(nextStep);
  }

  function next() {
    const message = validateStep(stepId, form);
    if (message) setError(message);
    else goTo(step + 1);
  }

  async function publish() {
    // Se revisan todos los pasos: un borrador viejo puede tener datos que ya no valen (por ejemplo, una fecha).
    for (const [index, id] of steps.entries()) {
      const message = validateStep(id, form);
      if (message) {
        draft.setStep(index);
        setError(message);
        return;
      }
    }
    setPublishing(true);
    setError('');
    try {
      await createPublication(buildPayload(form));
      await draft.finish();
      navigation.replace('MyPublications', { justPublished: true });
    } catch (publishError) {
      // Si falla (sin conexión, por ejemplo), el borrador queda guardado para reintentar.
      setError(publishError instanceof PhotoReadError ? publishError.message : getApiError(publishError));
      setPublishing(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {draft.restored && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Retomaste tu borrador donde lo dejaste.</Text>
          <PrimaryButton title="Empezar de nuevo" variant="secondary" disabled={publishing} onPress={draft.discard} />
        </View>
      )}
      <Text style={styles.progress}>Paso {step + 1} de {steps.length}</Text>
      <View style={styles.bar}><View style={[styles.barFill, { width: `${((step + 1) / steps.length) * 100}%` }]} /></View>
      <Text style={styles.title}>{STEP_TITLES[stepId]}</Text>

      <StepComponent form={form} onChange={draft.updateForm} />

      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
      {isLastStep
        ? <PrimaryButton title="Publicar" busy={publishing} onPress={publish} style={styles.action} />
        : <PrimaryButton title="Siguiente" onPress={next} style={styles.action} />}
      {step > 0 && <PrimaryButton title="Atrás" variant="secondary" disabled={publishing} onPress={() => goTo(step - 1)} style={styles.action} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  container: { flexGrow: 1, padding: 24, backgroundColor: colors.background },
  banner: { backgroundColor: colors.primarySoft, borderRadius: 10, padding: 12, marginBottom: 20 },
  bannerText: { fontSize: 15, color: colors.text, marginBottom: 8 },
  progress: { fontSize: 14, color: colors.muted, marginBottom: 8 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.primarySoft, marginBottom: 20 },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 20 },
  error: { fontSize: 15, lineHeight: 22, color: colors.error, marginTop: 8 },
  action: { marginTop: 12 },
});
