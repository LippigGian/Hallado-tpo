import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function handleLogout() {
    setBusy(true);
    try { await logout(); } catch { setError('No se pudo cerrar la sesión. Intentá nuevamente.'); setBusy(false); }
  }
  return <View style={styles.container}>
    <Text style={styles.title}>¡Bienvenido a Hallado!</Text>
    <Text style={styles.text}>Sesión iniciada como {user.email}</Text>
    <Text style={styles.text}>Esta pantalla provisoria permite comprobar la autenticación. Las publicaciones se incorporarán más adelante.</Text>
    <TouchableOpacity style={[styles.button, { marginBottom:12 }]} accessibilityRole="button" disabled={busy} onPress={() => navigation.navigate('Profile')}><Text style={styles.buttonText}>Mi perfil</Text></TouchableOpacity>
    <TouchableOpacity style={[styles.button, { marginBottom:12 }]} accessibilityRole="button" disabled={busy} onPress={() => navigation.navigate('Settings')}>
      <Text style={styles.buttonText}>Configuración</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.button} accessibilityRole="button" disabled={busy} onPress={handleLogout}>
      <Text style={styles.buttonText}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
    </TouchableOpacity>
    {!!error && <Text accessibilityLiveRegion="polite">{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor:'#F6F8F7' },
  title: { fontSize:28, fontWeight:'700', color:'#173F35', marginBottom:20 },
  text: { fontSize:16, lineHeight:24, color:'#52635B', marginBottom:16 },
  button: { backgroundColor:'#205B46', minHeight:52, padding:16, borderRadius:10, alignItems:'center' },
  buttonText: { color:'white', fontSize:16, fontWeight:'600' },
});
