import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { idDeUsuario, useConnectivity } from '../context/ConnectivityContext';
import { getNovelties } from '../services/alertService';
import { migrarAlertasLocales } from '../services/alerts/localAlertsMigration';
import { textoContador } from '../services/search/searchCriteria';

// Punto 9: botón del Menú con indicador de novedades.
function MenuButton({ title, onPress, disabled, contador = 0, descripcionContador = '' }) {
  const texto = textoContador(contador);
  return (
    <TouchableOpacity style={[styles.button, { marginBottom:12 }]} accessibilityRole="button" disabled={disabled} onPress={onPress}
      accessibilityLabel={texto ? `${title}, ${descripcionContador}` : title}>
      <View style={styles.buttonRow}>
        <Text style={styles.buttonText}>{title}</Text>
        {!!texto && <View style={styles.badge}><Text style={styles.badgeText}>{texto}</Text></View>}
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const userId = idDeUsuario(user);
  const { isOnline } = useConnectivity();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [novedades, setNovedades] = useState(null);

  // Las novedades se consultan cada vez que se vuelve al Menú. Sin conexión se mantienen las últimas.
  useFocusEffect(useCallback(() => {
    if (!isOnline) return undefined;
    let activo = true;
    migrarAlertasLocales(userId)
      .then(() => getNovelties())
      .then(datos => { if (activo) setNovedades(datos); })
      .catch(() => {});
    return () => { activo = false; };
  }, [isOnline, userId]));

  async function handleLogout() {
    setBusy(true);
    try { await logout(); } catch { setError('No se pudo cerrar la sesión. Intentá nuevamente.'); setBusy(false); }
  }

  const alertasNuevas = novedades?.alerts.new_publications ?? 0;
  const seguidasConCambios = novedades?.follows.updated ?? 0;

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>¡Bienvenido a Hallado!</Text>
    <Text style={styles.text}>Sesión iniciada como {user.email}</Text>
    <Text style={styles.text}>Desde acá accedés a la búsqueda, tus publicaciones, tus alertas, las publicaciones que seguís, tus reclamos, tu perfil y las pantallas de prueba.</Text>
    <MenuButton title="Buscar" disabled={busy} onPress={() => navigation.navigate('Search')} />
    <MenuButton title="Publicar pérdida o hallazgo" disabled={busy} onPress={() => navigation.navigate('PublishPublication')} />
    <MenuButton title="Mis publicaciones" disabled={busy} onPress={() => navigation.navigate('MyPublications')} />
    <MenuButton title="Mis alertas" disabled={busy} onPress={() => navigation.navigate('MyAlerts')}
      contador={alertasNuevas} descripcionContador={`${alertasNuevas} publicaci${alertasNuevas === 1 ? 'ón nueva' : 'ones nuevas'}`} />
    <MenuButton title="Seguidas" disabled={busy} onPress={() => navigation.navigate('FollowedPublications')}
      contador={seguidasConCambios} descripcionContador={`${seguidasConCambios} con cambios de estado`} />
    <MenuButton title="Mis reclamos" disabled={busy} onPress={() => navigation.navigate('MyClaims')} />
    <MenuButton title="Reclamar (prueba)" disabled={busy} onPress={() => navigation.navigate('ClaimDemo')} />
    <MenuButton title="Mi perfil" disabled={busy} onPress={() => navigation.navigate('Profile')} />
    <MenuButton title="Configuración" disabled={busy} onPress={() => navigation.navigate('Settings')} />
    <TouchableOpacity style={styles.button} accessibilityRole="button" disabled={busy} onPress={handleLogout}>
      <Text style={styles.buttonText}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
    </TouchableOpacity>
    {!!error && <Text accessibilityLiveRegion="polite">{error}</Text>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingBottom: 140, justifyContent: 'center', backgroundColor:'#F6F8F7' },
  title: { fontSize:28, fontWeight:'700', color:'#173F35', marginBottom:20 },
  text: { fontSize:16, lineHeight:24, color:'#52635B', marginBottom:16 },
  button: { backgroundColor:'#205B46', minHeight:52, padding:16, borderRadius:10, alignItems:'center' },
  buttonRow: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  buttonText: { color:'white', fontSize:16, fontWeight:'600' },
  badge: { minWidth:24, height:24, borderRadius:12, paddingHorizontal:6, backgroundColor:'#F2B544', alignItems:'center', justifyContent:'center' },
  badgeText: { color:'#173F35', fontSize:13, fontWeight:'700' },
});
