// Miniatura de la foto de portada de una publicación en las tarjetas de reclamos e historial.
// Sin foto muestra un recuadro vacío del mismo tamaño, así las tarjetas quedan alineadas.
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../config/theme';
import { apiUrl } from '../services/api';

export default function CoverThumbnail({ path, title }) {
  const uri = apiUrl(path);
  return uri
    ? <Image source={{ uri }} style={styles.cover} accessibilityLabel={`Foto de ${title}`} />
    : <View style={[styles.cover, styles.empty]} />;
}

const styles = StyleSheet.create({
  cover: { width: 84, height: 84, borderRadius: 10, backgroundColor: colors.primarySoft },
  empty: { opacity: 0.6 },
});
