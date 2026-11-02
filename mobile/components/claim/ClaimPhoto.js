import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../../config/theme';
import { apiUrl } from '../../services/api';
import { useSessionToken } from '../../hooks/useSessionToken';

export default function ClaimPhoto({ photoUrl }) {
  const token = useSessionToken();
  if (!token) return <View style={styles.photo} />;
  return (
    <Image
      source={{ uri: apiUrl(photoUrl), headers: { Authorization: `Bearer ${token}` } }}
      style={styles.photo}
      resizeMode="cover"
      accessibilityLabel="Foto del reclamo"
    />
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 240, borderRadius: 12, backgroundColor: colors.primarySoft },
});
