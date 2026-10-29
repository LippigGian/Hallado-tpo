import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
export default function SettingsScreen() {
  const { biometricEnabled, setBiometricEnabled, lock } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function toggle(enabled) {
    setBusy(true); setMessage('');
    try { await setBiometricEnabled(enabled); setMessage(enabled ? 'Desbloqueo biométrico activado.' : 'Desbloqueo biométrico desactivado.'); }
    catch(error) { setMessage(error.message || 'No se pudo cambiar la configuración.'); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Seguridad</Text>
    <Text style={styles.text}>Desbloqueá la sesión guardada con la biometría del dispositivo al volver a abrir la app o regresar del segundo plano.</Text>
    <View style={styles.row}>
      <Text style={styles.label}>Desbloqueo biométrico</Text>
      <Switch accessibilityLabel="Desbloqueo biométrico" value={biometricEnabled} disabled={busy} onValueChange={toggle} trackColor={{ true:'#205B46' }} />
    </View>
    <Text style={styles.text}>Se verificará tu identidad para activar o desactivar la opción. Al cerrar sesión se elimina la preferencia de esa sesión; podés activarla después de ingresar nuevamente. La biometría no prolonga el vencimiento del token.</Text>
    {biometricEnabled && <TouchableOpacity style={styles.button} disabled={busy} accessibilityRole="button" onPress={lock}><Text style={styles.buttonText}>Bloquear ahora para probar</Text></TouchableOpacity>}
    {!!message && <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  container:{ flexGrow:1,padding:24,backgroundColor:'#F6F8F7' },
  title:{fontSize:28,fontWeight:'700',color:'#173F35',marginBottom:20},
  text:{fontSize:16,lineHeight:24,color:'#52635B',marginBottom:20},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:64,marginBottom:20},
  label:{fontSize:16,color:'#173F35',flex:1,marginRight:12},
  button:{minHeight:52,padding:16,borderRadius:10,backgroundColor:'#205B46',justifyContent:'center'},
  buttonText:{color:'white',fontSize:16,fontWeight:'600',textAlign:'center'},
  message:{fontSize:15,lineHeight:23,color:'#173F35',marginTop:20},
});
