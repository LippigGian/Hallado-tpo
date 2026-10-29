import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { getMyProfile } from '../services/profileService';
import { getApiError } from '../services/api';
import ProfileSummary from '../components/ProfileSummary';

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  // Volver desde Editar vuelve a consultar los datos efectivamente guardados.
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    async function load() {
      try {
        const data = await getMyProfile();
        if (active) setProfile(data);
      } catch (error) {
        if (active) setError(getApiError(error));
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [retry]));

  return <ScrollView contentContainerStyle={styles.container}>
    {loading ? <ActivityIndicator size="large" accessibilityLabel="Cargando perfil" /> : <>
      {!!error && <>
        <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
        <TouchableOpacity style={styles.secondary} accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={styles.link}>Reintentar</Text></TouchableOpacity>
      </>}
      {profile && <>
        <TouchableOpacity style={styles.button} accessibilityRole="button" onPress={() => navigation.navigate('EditProfile')}><Text style={styles.buttonText}>Editar perfil</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} accessibilityRole="button" onPress={() => navigation.navigate('PublicProfile', { userId: profile.id })}><Text style={styles.link}>Ver mi perfil público</Text></TouchableOpacity>
        <ProfileSummary profile={profile} privateDetails />
      </>}
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F6F8F7' },
  button: { minHeight: 52, padding: 16, borderRadius: 10, backgroundColor: '#205B46', justifyContent: 'center', marginBottom: 8 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondary: { minHeight: 48, padding: 12, justifyContent: 'center', marginBottom: 16 },
  link: { color: '#205B46', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  error: { color: '#A32929', fontSize: 15, lineHeight: 23, marginBottom: 12 },
});
