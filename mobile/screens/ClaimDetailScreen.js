import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getApiError } from '../services/api';
import { acceptClaim, confirmReturn, getClaim, getCounterpartPhone, rejectClaim } from '../services/claimService';
import { colors } from '../config/theme';
import { CLAIM_ACTION_LABELS } from '../config/claimOptions';
import { formatDateTime } from '../utils/dateTime';
import ConnectionRequiredButton from '../components/offline/ConnectionRequiredButton';
import PrimaryButton from '../components/PrimaryButton';
import ClaimStatusBadge from '../components/claim/ClaimStatusBadge';
import ClaimEvidence from '../components/claim/ClaimEvidence';
import ClaimAcceptedInfo from '../components/claim/ClaimAcceptedInfo';
import MeetingPointSection from '../components/meetingPoint/MeetingPointSection';
import ClaimReturnSection from '../components/claim/ClaimReturnSection';

const DECISIONS = {
  accept: {
    title: 'Aceptar reclamo',
    message: 'Si lo aceptás, se rechazan los demás reclamos pendientes y ambos podrán coordinar la devolución.',
    confirm: 'Aceptar',
    perform: acceptClaim,
  },
  reject: {
    title: 'Rechazar reclamo',
    message: 'La persona podrá volver a intentarlo mientras le queden intentos.',
    confirm: 'Rechazar',
    perform: rejectClaim,
  },
};

const CLOSED_MESSAGES = {
  rejected: 'Este reclamo fue rechazado.',
  expired: 'Este reclamo venció porque no recibió respuesta a tiempo.',
};

export default function ClaimDetailScreen({ navigation, route }) {
  const { claimId } = route.params;
  const [claim, setClaim] = useState(null);
  const [phone, setPhone] = useState(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setClaim(await getClaim(claimId));
      setError('');
    } catch (loadError) {
      setError(getApiError(loadError));
    }
  }, [claimId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const accepted = claim?.status === 'accepted';
  const counterpart = claim && (claim.role === 'publisher' ? claim.claimant : claim.publisher);

  useEffect(() => {
    if (!accepted) return;
    getCounterpartPhone(counterpart.id, claim.id).then(setPhone).catch(() => setPhone(null));
  }, [accepted, counterpart?.id, claim?.id]);

  async function decide(decision) {
    setBusy(true);
    setError('');
    try {
      setClaim(await DECISIONS[decision].perform(claim.id));
    } catch (decisionError) {
      setError(getApiError(decisionError));
      load();
    } finally {
      setBusy(false);
    }
  }

  // Punto 10: quien recupera confirma la devolución.
  async function returnConfirmed() {
    setBusy(true);
    setError('');
    try {
      setClaim(await confirmReturn(claim.id));
    } catch (returnError) {
      setError(getApiError(returnError));
      load();
    } finally {
      setBusy(false);
    }
  }

  function confirm(decision) {
    const { title, message, confirm: confirmLabel } = DECISIONS[decision];
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: confirmLabel, onPress: () => decide(decision) },
    ]);
  }

  if (!claim) {
    return error
      ? <View style={styles.container}><Text style={styles.error}>{error}</Text><PrimaryButton title="Reintentar" onPress={load} /></View>
      : <ActivityIndicator style={styles.loading} size="large" accessibilityLabel="Cargando reclamo" />;
  }

  const canDecide = claim.role === 'publisher' && claim.status === 'pending';
  const returned = !!claim.return?.returned;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kind}>{CLAIM_ACTION_LABELS[claim.kind]}</Text>
      <Text style={styles.title}>{claim.publication.title}</Text>
      <ClaimStatusBadge status={claim.status} returned={returned} />
      {claim.status === 'pending' && <Text style={styles.text}>Vence el {formatDateTime(new Date(claim.expires_at))}</Text>}
      {!!CLOSED_MESSAGES[claim.status] && <Text style={styles.text}>{CLOSED_MESSAGES[claim.status]}</Text>}

      <View style={styles.section}>
        <Text style={styles.text}>
          {claim.role === 'publisher' ? `Reclamo de ${counterpart.name}` : `Publicación de ${counterpart.name}`}
        </Text>
        <PrimaryButton
          title="Ver perfil público"
          variant="secondary"
          onPress={() => navigation.navigate('PublicProfile', { userId: counterpart.id })}
        />
      </View>

      {accepted && (
        <ClaimAcceptedInfo
          claim={claim}
          counterpart={counterpart}
          phone={phone}
          onOpenProfile={() => navigation.navigate('PublicProfile', { userId: counterpart.id })}
        />
      )}

      {accepted && (
        <ClaimReturnSection claim={claim} counterpartName={counterpart.name} busy={busy} onConfirm={returnConfirmed}
          onOpenHistory={() => navigation.navigate('History')} />
      )}

      {/* Con la devolución concretada ya no hay nada que coordinar. */}
      {accepted && !returned && <MeetingPointSection claimId={claim.id} counterpartName={counterpart.name} />}

      <ClaimEvidence claim={claim} />

      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}

      {canDecide && (
        <View style={styles.actions}>
          <ConnectionRequiredButton titulo="Aceptar reclamo" disabled={busy} onPress={() => confirm('accept')} />
          <ConnectionRequiredButton titulo="Rechazar reclamo" variante="secundario" disabled={busy} onPress={() => confirm('reject')} style={styles.secondAction} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  container: { flexGrow: 1, padding: 24, backgroundColor: colors.background },
  kind: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 8 },
  text: { fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 4 },
  section: { marginVertical: 16 },
  error: { fontSize: 15, lineHeight: 22, color: colors.error, marginVertical: 12 },
  actions: { marginTop: 8 },
  secondAction: { marginTop: 12 },
});
