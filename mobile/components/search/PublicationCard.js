// Punto 3 - Buscador inicial y resultados: tarjeta de un resultado de búsqueda.
import { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORIAS, ESTADOS, FRANJAS, formatearFecha } from '../../services/search/searchCriteria';

function FotoMini({ uri }) {
  const [fallo, setFallo] = useState(false);
  if (!uri || fallo) return <View style={[styles.foto, styles.sinFoto]}><Text style={styles.sinFotoTexto}>Sin foto</Text></View>;
  return <Image source={{ uri }} style={styles.foto} onError={() => setFallo(true)} accessibilityLabel="Foto de la publicación" />;
}

// `novedad` (punto 9): texto destacado arriba de la tarjeta, por ejemplo "Nueva" o
// "Cambió de estado: …". `mostrarEstado`: muestra el estado aunque sea "Abierta".
export default function PublicationCard({ publicacion, onPress, novedad, mostrarEstado = false }) {
  const categoria = CATEGORIAS.find(c => c.id === publicacion.category)?.etiqueta || publicacion.category;
  const franja = FRANJAS.find(f => f.id === publicacion.time_slot)?.etiqueta;
  const fotos = (publicacion.fotos || []).slice(0, 3);
  const Contenedor = onPress ? TouchableOpacity : View;
  const estado = ESTADOS.find(e => e.id === publicacion.status)?.etiqueta;
  return (
    <Contenedor style={[styles.tarjeta, !!novedad && styles.tarjetaNovedad]} accessibilityRole={onPress ? 'button' : undefined} onPress={onPress}>
      {!!novedad && <View style={styles.novedad}><Text style={styles.novedadTexto}>{novedad}</Text></View>}
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
      {mostrarEstado && estado
        ? <View style={[styles.insignia, publicacion.status === 'open' && styles.insigniaAbierta]}>
          <Text style={[styles.insigniaTexto, publicacion.status === 'open' && styles.insigniaAbiertaTexto]}>{estado}</Text>
        </View>
        : publicacion.status === 'claimed' && <View style={styles.insignia}><Text style={styles.insigniaTexto}>En reclamo</Text></View>}
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
  insigniaAbierta: { backgroundColor: '#DCEAE1' },
  insigniaAbiertaTexto: { color: '#205B46' },
  tarjetaNovedad: { borderColor: '#205B46', borderWidth: 2 },
  novedad: { alignSelf: 'flex-start', backgroundColor: '#205B46', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10 },
  novedadTexto: { color: 'white', fontSize: 12, fontWeight: '700' },
});
