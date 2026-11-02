import { StyleSheet, Text, View } from 'react-native';
import PhotoPicker from '../PhotoPicker';
import { colors } from '../../config/theme';
import { LIMITS } from '../../config/publicationOptions';

export default function PhotosStep({ form, onChange }) {
  return (
    <View>
      <Text style={styles.text}>
        Las fotos ayudan a reconocer el objeto o la mascota. Podés agregar hasta {LIMITS.maxPhotos}; la primera es la portada.
      </Text>
      <PhotoPicker photos={form.photos} onChange={photos => onChange({ photos })} max={LIMITS.maxPhotos} />
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 16, lineHeight: 24, color: colors.muted, marginBottom: 16 },
});
