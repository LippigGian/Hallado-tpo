// Punto 10: un caso resuelto del historial, con su estado de valoraciones y agradecimiento.
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../config/theme';
import { CATEGORIES } from '../../config/publicationOptions';
import { apiUrl } from '../../services/api';
import { textoCaso, textoPlazo, textoValoracion } from '../../services/history/historyView';
import ConnectionRequiredButton from '../offline/ConnectionRequiredButton';

const categoria = value => CATEGORIES.find(item => item.value === value)?.label ?? value;

function Linea({ label, value }) {
  if (!value) return null;
  return <Text style={styles.text}><Text style={styles.label}>{label}: </Text>{value}</Text>;
}

export default function HistoryCard({ caso, pestania, onOpenProfile, onRate, onThank }) {
  const cover = apiUrl(caso.publication.cover_photo_url);
  const fb = caso.feedback;
  const plazo = textoPlazo(caso);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {cover
          ? <Image source={{ uri: cover }} style={styles.cover} accessibilityLabel={`Foto de ${caso.publication.title}`} />
          : <View style={[styles.cover, styles.noCover]} />}
        <View style={styles.info}>
          <Text style={styles.kind}>{categoria(caso.publication.category)}</Text>
          <Text style={styles.title} numberOfLines={2}>{caso.publication.title}</Text>
          <Text style={styles.text}>{textoCaso(caso, pestania)}</Text>
          <TouchableOpacity accessibilityRole="link" onPress={onOpenProfile}>
            <Text style={styles.link}>Ver perfil de {caso.counterpart.name}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.feedback}>
        <Linea label="Tu valoración" value={textoValoracion(fb.given_rating)} />
        <Linea label={`Valoración de ${caso.counterpart.name}`} value={textoValoracion(fb.received_rating)} />
        <Linea label={pestania === 'recovered' ? 'Tu agradecimiento' : 'Te agradeció'} value={fb.thanks ? `“${fb.thanks.message}”` : ''} />
        {!fb.open && !fb.given_rating && <Text style={styles.text}>El plazo de 7 días para valorar ya venció.</Text>}
        {!!plazo && <Text style={styles.text}>{plazo}</Text>}
      </View>

      {(fb.can_rate || fb.can_thank) && (
        <View style={styles.actions}>
          {fb.can_rate && <ConnectionRequiredButton titulo={`Valorar a ${caso.counterpart.name}`} onPress={onRate} />}
          {fb.can_thank && <ConnectionRequiredButton titulo="Dejar un agradecimiento" variante="secundario" onPress={onThank} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.primarySoft },
  row: { flexDirection: 'row', gap: 12 },
  cover: { width: 84, height: 84, borderRadius: 10, backgroundColor: colors.primarySoft },
  noCover: { opacity: 0.6 },
  info: { flex: 1 },
  kind: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  text: { fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontWeight: '700', color: colors.text },
  link: { fontSize: 14, lineHeight: 20, color: colors.primary, fontWeight: '600', marginTop: 4 },
  feedback: { marginTop: 12, gap: 4 },
  actions: { marginTop: 12, gap: 10 },
});
