import { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import PrimaryButton from './PrimaryButton';
import { colors } from '../config/theme';
import { LIMITS } from '../config/publicationOptions';

export default function PhotoPicker({ photos, onChange, max = LIMITS.maxPhotos }) {
  const { runNativeActivity } = useAuth();
  const [message, setMessage] = useState('');
  const single = max === 1;
  const remaining = max - photos.length;
  const full = !single && remaining <= 0;

  function addAssets(assets) {
    const added = [];
    for (const asset of assets) {
      if ((asset.fileSize ?? 0) > LIMITS.maxPhotoBytes) setMessage('Una foto pesa más de 2 MB y no se agregó. Probá con otra.');
      else added.push({ uri: asset.uri, base64: asset.base64 ?? null });
    }
    if (!added.length) return;
    onChange(single ? added.slice(0, 1) : [...photos, ...added].slice(0, max));
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
        mediaTypes: ['images'],
        allowsMultipleSelection: !single,
        selectionLimit: single ? 1 : remaining,
        quality: 0.5,
        base64: true,
      }));
      if (!result.canceled) addAssets(result.assets);
    } catch {
      setMessage('No se pudo abrir la galería. Intentá nuevamente.');
    }
  }

  function removePhoto(uri) {
    onChange(photos.filter(photo => photo.uri !== uri));
  }

  return (
    <View>
      <PrimaryButton title="Tomar foto" onPress={takePhoto} disabled={full} style={styles.button} />
      <PrimaryButton title="Elegir de la galería" variant="secondary" onPress={pickFromGallery} disabled={full} style={styles.button} />
      {!!message && <Text style={styles.error} accessibilityLiveRegion="polite">{message}</Text>}
      {!single && <Text style={styles.counter}>{photos.length} de {max} fotos</Text>}
      <View style={styles.grid}>
        {photos.map(({ uri }, index) => (
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
