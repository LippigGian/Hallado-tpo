import { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import PrimaryButton from '../PrimaryButton';
import { colors } from '../../config/theme';
import { LIMITS } from '../../config/publicationOptions';

// Paso 2: fotos con la cámara o desde la galería (de 1 a 5).
export default function PhotosStep({ form, onChange }) {
  // La cámara y la galería abren pantallas de Android: runNativeActivity evita que la app se bloquee
  // con la biometría mientras tanto (igual que en Editar perfil).
  const { runNativeActivity } = useAuth();
  const [message, setMessage] = useState('');
  const remaining = LIMITS.maxPhotos - form.photos.length;

  // base64: true hace que el selector entregue la foto ya codificada (así se envía a la API).
  function addAssets(assets) {
    const photos = [];
    for (const asset of assets) {
      const tooBig = (asset.fileSize ?? 0) > LIMITS.maxPhotoBytes;
      if (tooBig) setMessage('Una foto pesa más de 2 MB y no se agregó. Probá con otra.');
      else photos.push({ uri: asset.uri, base64: asset.base64 ?? null });
    }
    onChange({ photos: [...form.photos, ...photos].slice(0, LIMITS.maxPhotos) });
  }

  async function takePhoto() {
    setMessage('');
    try {
      const result = await runNativeActivity(async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return null;
        return ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
      });
      if (result === null) setMessage('Sin permiso de cámara no podemos sacar la foto. Podés elegirla de la galería.');
      else if (!result.canceled) addAssets(result.assets);
    } catch {
      setMessage('No se pudo abrir la cámara. Probá con la galería.');
    }
  }

  async function pickFromGallery() {
    setMessage('');
    try {
      const result = await runNativeActivity(() => ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.5, base64: true,
      }));
      if (!result.canceled) addAssets(result.assets);
    } catch {
      setMessage('No se pudo abrir la galería. Intentá nuevamente.');
    }
  }

  function removePhoto(uri) {
    onChange({ photos: form.photos.filter(photo => photo.uri !== uri) });
  }

  return (
    <View>
      <Text style={styles.text}>
        Las fotos ayudan a reconocer el objeto o la mascota. Podés agregar hasta {LIMITS.maxPhotos}; la primera es la portada.
      </Text>
      <PrimaryButton title="Tomar foto" onPress={takePhoto} disabled={remaining <= 0} style={styles.button} />
      <PrimaryButton title="Elegir de la galería" variant="secondary" onPress={pickFromGallery} disabled={remaining <= 0} style={styles.button} />
      {!!message && <Text style={styles.error} accessibilityLiveRegion="polite">{message}</Text>}
      <Text style={styles.counter}>{form.photos.length} de {LIMITS.maxPhotos} fotos</Text>
      <View style={styles.grid}>
        {form.photos.map(({ uri }, index) => (
          <View key={uri} style={styles.thumbnailBox}>
            <Image source={{ uri }} style={styles.thumbnail} accessibilityLabel={`Foto ${index + 1}`} />
            <TouchableOpacity
              style={styles.remove}
              accessibilityRole="button"
              accessibilityLabel={`Quitar foto ${index + 1}`}
              onPress={() => removePhoto(uri)}
            >
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 16, lineHeight: 24, color: colors.muted, marginBottom: 16 },
  button: { marginBottom: 12 },
  error: { fontSize: 15, lineHeight: 22, color: colors.error, marginBottom: 12 },
  counter: { fontSize: 15, color: colors.muted, marginVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  thumbnailBox: { width: 104, height: 104 },
  thumbnail: { width: 104, height: 104, borderRadius: 10, backgroundColor: colors.primarySoft },
  remove: {
    position: 'absolute', top: -8, right: -8, width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center',
  },
  removeText: { color: 'white', fontSize: 14, fontWeight: '700' },
});
