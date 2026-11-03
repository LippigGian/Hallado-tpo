// Punto 3 - Buscador inicial y resultados: tarjeta de un resultado de búsqueda.
import { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORIAS, FRANJAS, formatearFecha } from '../../services/search/searchCriteria';

function FotoMini({ uri }) {
  const [fallo, setFallo] = useState(false);
  if (!uri || fallo) return <View style={[styles.foto, styles.sinFoto]}><Text style={styles.sinFotoTexto}>Sin foto</Text></View>;
  return <Image source={{ uri }} style={styles.foto} onError={() => setFallo(true)} accessibilityLabel="Foto de la publicación" />;
}

export default function PublicationCard({ publicacion, onPress }) {
  const categoria = CATEGORIAS.find(c => c.id === publicacion.category)?.etiqueta || publicacion.category;
  const franja = FRANJAS.find(f => f.id === publicacion.time_slot)?.etiqueta;
  const fotos = (publicacion.fotos || []).slice(0, 3);
  const Contenedor = onPress ? TouchableOpacity : View;
  return (
    <Contenedor style={styles.tarjeta} accessibilityRole={onPress ? 'button' : undefined} onPress={onPress}>
      <View style={styles.fotos}>
        {fotos.length ? fotos.map((uri, i) => <FotoMini key={i} uri={uri} />) : <FotoMini uri={null} />}
      </View>
      <Text style={styles.titulo} numberOfLines={2}>{publicacion.title}</Text>
      <Text style={styles.texto}>{categoria} · {publicacion.neighborhood}</Text>
      <Text style={styles.texto}>Fecha del suceso: {formatearFecha(publicacion.occurred_on)}{franja ? ` · ${franja}` : ''}</Text>
      {typeof publicacion.approx_latitude === 'number' && typeof publicacion.approx_longitude === 'number' && (
        <Text style={styles.textoSecundario}>Coordenadas aprox.: {publicacion.approx_latitude}, {publicacion.approx_longitude}</Text>
      )}
      {typeof publicacion.distance_km === 'number' && <Text style={styles.textoSecundario}>a {publicacion.distance_km} km</Text>}
      {publicacion.status === 'claimed' && <View style={styles.insignia}><Text style={styles.insigniaTexto}>En reclamo</Text></View>}
    </Contenedor>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E1E7E4' },
  fotos: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  foto: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#E1E7E4' },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  sinFotoTexto: { fontSize: 11, color: '#6B7B74', textAlign: 'center', paddingHorizontal: 4 },
  titulo: { fontSize: 16, fontWeight: '700', color: '#173F35', marginBottom: 4 },
  texto: { fontSize: 14, color: '#52635B', lineHeight: 20 },
  textoSecundario: { fontSize: 13, color: '#6B7B74' },
  insignia: { alignSelf: 'flex-start', backgroundColor: '#F4DCD6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8 },
  insigniaTexto: { color: '#8A3B2E', fontSize: 12, fontWeight: '700' },
});
