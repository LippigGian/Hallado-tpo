// Punto 10: devolución concretada de un reclamo aceptado. La confirma quien recupera el objeto;
// quien lo devuelve ve que está pendiente. Una vez confirmada, la publicación queda resuelta.
import { Alert, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../config/theme';
import { formatDateTime } from '../../utils/dateTime';
import ConnectionRequiredButton from '../offline/ConnectionRequiredButton';
import PrimaryButton from '../PrimaryButton';

export default function ClaimReturnSection({ claim, counterpartName, busy, onConfirm, onOpenHistory }) {
  const ret = claim.return;
  if (!ret) return null;

  if (ret.returned) {
    return (
      <View style={[styles.container, styles.done]}>
        <Text style={styles.title}>Devolución concretada</Text>
        <Text style={styles.text}>
          {ret.role === 'recoverer' ? `Recuperaste el objeto. ${counterpartName} te lo devolvió` : `Devolviste el objeto a ${counterpartName}`}
          {ret.returned_at ? ` el ${formatDateTime(new Date(ret.returned_at))}.` : '.'}
        </Text>
        <Text style={styles.text}>Durante 7 días pueden valorarse desde el Historial.</Text>
        {!!onOpenHistory && <PrimaryButton title="Ir al historial" variant="secondary" onPress={onOpenHistory} />}
      </View>
    );
  }

  if (ret.can_confirm) {
    const confirm = () => Alert.alert(
      'Confirmar devolución',
      `¿Ya tenés “${claim.publication.title}” en tus manos? La publicación quedará resuelta y no se puede deshacer.`,
      [
        { text: 'Todavía no', style: 'cancel' },
        { text: 'Sí, lo recuperé', onPress: onConfirm },
      ],
    );
    return (
      <View style={styles.container}>
        <Text style={styles.title}>¿Ya lo recuperaste?</Text>
        <Text style={styles.text}>Cuando {counterpartName} te entregue el objeto, confirmá la devolución para cerrar el caso.</Text>
        <ConnectionRequiredButton titulo="Confirmar devolución" disabled={busy} onPress={confirm} />
      </View>
    );
  }

  if (ret.role === 'returner' && claim.status === 'accepted') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Devolución pendiente</Text>
        <Text style={styles.text}>Cuando {counterpartName} reciba el objeto, va a confirmar la devolución desde su reclamo.</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.primarySoft },
  done: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 6 },
  text: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 12 },
});
