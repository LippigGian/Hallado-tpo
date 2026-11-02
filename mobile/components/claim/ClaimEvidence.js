import { StyleSheet, Text, View } from 'react-native';
import DetailRow from '../DetailRow';
import ClaimPhoto from './ClaimPhoto';
import { colors } from '../../config/theme';
import { answersMatch } from '../../utils/claimAnswers';

function AnswerComparison({ claim }) {
  const matches = answersMatch(claim.verification_answer, claim.expected_answer);
  return (
    <View>
      <DetailRow label="Tu respuesta esperada" value={claim.expected_answer} />
      <Text style={[styles.comparison, { color: matches ? colors.primary : colors.error }]}>
        {matches ? 'Coincide con la respuesta recibida.' : 'No coincide con la respuesta recibida.'}
      </Text>
    </View>
  );
}

export default function ClaimEvidence({ claim }) {
  const isOwnerClaim = claim.kind === 'owner';
  return (
    <View>
      {isOwnerClaim && <DetailRow label="Pregunta de verificación" value={claim.verification_question} />}
      {isOwnerClaim && <DetailRow label="Respuesta recibida" value={claim.verification_answer} />}
      {isOwnerClaim && claim.role === 'publisher' && <AnswerComparison claim={claim} />}
      {!isOwnerClaim && <DetailRow label="Barrio donde lo encontró" value={claim.found_neighborhood} />}
      {!!claim.description && <DetailRow label="Descripción" value={claim.description} />}
      {!!claim.photo_url && (
        <View style={styles.photo}>
          <Text style={styles.photoLabel}>Foto adjunta</Text>
          <ClaimPhoto photoUrl={claim.photo_url} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  comparison: { fontSize: 15, fontWeight: '700', marginTop: -8, marginBottom: 14 },
  photo: { marginTop: 4 },
  photoLabel: { fontSize: 14, fontWeight: '700', color: colors.muted, marginBottom: 6 },
});
