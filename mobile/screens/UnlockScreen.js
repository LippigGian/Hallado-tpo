import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getApiError } from '../services/api';
export default function UnlockScreen() {
  const { unlock, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action) {
    setBusy(true); setError('');
    try { await action(); }
    catch (error) { setError(error.isAxiosError ? getApiError(error) : error.message || 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  }
  return <View style={styles.container}>
    <Text style={styles.title}>Sesión bloqueada</Text>
    <Text style={styles.text}>Verificá tu identidad para volver a Hallado.</Text>
    <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => run(unlock)}><Text style={styles.buttonText}>{busy ? 'Verificando…' : 'Desbloquear con biometría'}</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => run(logout)}><Text style={styles.link}>Ingresar con email y contraseña</Text></TouchableOpacity>
    {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
  </View>;
}
const styles=StyleSheet.create({
  container:{flex:1,padding:24,justifyContent:'center',backgroundColor:'#F6F8F7'},
  title:{fontSize:28,fontWeight:'700',color:'#173F35',marginBottom:20},
  text:{fontSize:16,lineHeight:24,color:'#52635B',marginBottom:24},
  button:{minHeight:52,padding:16,borderRadius:10,backgroundColor:'#205B46',justifyContent:'center'},
  buttonText:{color:'white',fontSize:16,fontWeight:'600',textAlign:'center'},
  secondary:{minHeight:52,padding:16,justifyContent:'center',marginTop:12},
  link:{color:'#205B46',fontSize:16,fontWeight:'600',textAlign:'center'},
  error:{color:'#A32929',fontSize:15,lineHeight:23,marginTop:16},
});
