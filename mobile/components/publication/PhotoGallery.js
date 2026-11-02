// Punto 4 - Detalle de la publicación: galería de fotos deslizable.
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export default function PhotoGallery({ uris = [], titulo = '' }) {
  const { width } = useWindowDimensions();
  const [indice, setIndice] = useState(0);

  if (!uris.length) {
    return <View style={[styles.contenedor, styles.sinFotos, { width }]}><Text style={styles.sinFotosTexto}>Sin fotos</Text></View>;
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setIndice(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {uris.map((uri, i) => (
          <FotoPagina key={i} uri={uri} width={width} indice={i} total={uris.length} titulo={titulo} />
        ))}
      </ScrollView>
      {uris.length > 1 && (
        <View style={styles.contador}><Text style={styles.contadorTexto}>{indice + 1} / {uris.length}</Text></View>
      )}
    </View>
  );
}

function FotoPagina({ uri, width, indice, total, titulo }) {
  const [fallo, setFallo] = useState(false);
  if (!uri || fallo) {
    return <View style={[styles.contenedor, styles.sinFotos, { width }]}><Text style={styles.sinFotosTexto}>No se pudo cargar la foto</Text></View>;
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.contenedor, { width }]}
      accessibilityLabel={`Foto ${indice + 1} de ${total} de ${titulo}`}
      onError={() => setFallo(true)}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  contenedor: { height: 260, backgroundColor: '#E1E7E4' },
  sinFotos: { alignItems: 'center', justifyContent: 'center' },
  sinFotosTexto: { color: '#6B7B74', fontSize: 14 },
  contador: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(23,63,53,0.75)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  contadorTexto: { color: 'white', fontSize: 12, fontWeight: '600' },
});
