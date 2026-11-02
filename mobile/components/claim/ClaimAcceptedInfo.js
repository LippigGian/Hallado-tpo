import { StyleSheet, Text, View } from 'react-native';
import DetailRow from '../DetailRow';
import PrimaryButton from '../PrimaryButton';
import { colors } from '../../config/theme';

function phoneLabel(phone) {
  if (phone === undefined) return 'Consultando…';
  return phone ?? 'Prefiere comunicarse solo a través de la app.';
}

export default function ClaimAcceptedInfo({ claim, counterpart, phone, onOpenProfile }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reclamo aceptado</Text>
      <Text style={styles.text}>Ya pueden coordinar la devolución. Ahora ven la dirección exacta del lugar.</Text>
      <DetailRow label="Dirección" value={claim.publication.address} />
      <DetailRow label={`Teléfono de ${counterpart.name}`} value={phoneLabel(phone)} />
      <PrimaryButton title={`Ver perfil de ${counterpart.name}`} variant="secondary" onPress={onOpenProfile} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.primarySoft, borderRadius: 12, padding: 16, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 6 },
  text: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 14 },
});
