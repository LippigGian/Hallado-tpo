// Punto 4 - Detalle de la publicación: datos del publicador, reputación y acceso al perfil público.
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function antiguedad(fechaISO) {
  if (!fechaISO) return '';
  const inicio = new Date(fechaISO);
  const meses = Math.max(0, Math.floor((Date.now() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  if (meses < 1) return 'En Hallado desde este mes';
  if (meses < 12) return `En Hallado desde hace ${meses} mes${meses === 1 ? '' : 'es'}`;
  const anios = Math.floor(meses / 12);
  return `En Hallado desde hace ${anios} año${anios === 1 ? '' : 's'}`;
}

export default function PublisherCard({ publisher, onVerPerfil }) {
  if (!publisher) return null;
  const { name, neighborhood, photo_url: photoUrl, created_at: createdAt, reputation } = publisher;
  return (
    <View style={styles.tarjeta}>
      <View style={styles.fila}>
        {photoUrl
          ? <Image source={{ uri: photoUrl }} style={styles.foto} accessibilityLabel={`Foto de ${name || 'Vecino de Hallado'}`} />
          : <View style={[styles.foto, styles.sinFoto]}><Text style={styles.inicial}>{(name || 'V')[0]?.toUpperCase()}</Text></View>}
        <View style={styles.datos}>
          <Text style={styles.nombre}>{name || 'Vecino de Hallado'}</Text>
          {!!neighborhood && <Text style={styles.texto}>{neighborhood}</Text>}
          <Text style={styles.texto}>{antiguedad(createdAt)}</Text>
        </View>
      </View>
      {!!reputation && (
        <Text style={styles.reputacion}>
          {reputation.score} punto{reputation.score === 1 ? '' : 's'} · {reputation.completed_returns} devolución{reputation.completed_returns === 1 ? '' : 'es'}
        </Text>
      )}
      {!!reputation?.badges?.length && (
        <View style={styles.insignias}>
          {reputation.badges.map(b => (
            <View key={b.id} style={styles.insignia}><Text style={styles.insigniaTexto}>{b.name}</Text></View>
          ))}
        </View>
      )}
      <TouchableOpacity style={styles.boton} accessibilityRole="button" onPress={onVerPerfil}>
        <Text style={styles.botonTexto}>Ver perfil público</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#E1E7E4' },
  fila: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  foto: { width: 52, height: 52, borderRadius: 26, marginRight: 12, backgroundColor: '#E1E7E4' },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  inicial: { fontSize: 20, fontWeight: '700', color: '#205B46' },
  datos: { flex: 1 },
  nombre: { fontSize: 16, fontWeight: '700', color: '#173F35' },
  texto: { fontSize: 13, color: '#52635B' },
  reputacion: { fontSize: 14, color: '#173F35', fontWeight: '600', marginBottom: 6 },
  insignias: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  insignia: { backgroundColor: '#DCEFE6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  insigniaTexto: { color: '#205B46', fontSize: 12, fontWeight: '700' },
  boton: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: '#205B46', alignItems: 'center', justifyContent: 'center' },
  botonTexto: { color: '#205B46', fontSize: 14, fontWeight: '600' },
});
