import { useAuth } from '../context/AuthContext';
import { getApiError } from '../services/api';
import { useState } from 'react';
import { validateEmail } from '../utils/authValidation';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen({ navigation }) {
  const { login, sessionMessage } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');

  async function handleLogin() {
    if (busy) return;
    const nextErrors = {};
    const emailError = validateEmail(email);
    if (emailError) nextErrors.email = emailError;
    if (!password) nextErrors.password = 'Ingresá tu contraseña.';
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try { await login(email, password); setPassword(''); }
    catch (error) { setMessage(getApiError(error)); }
    finally { setBusy(false); }
  }
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.brand}>HALLADO</Text>
          {!!sessionMessage && <Text style={styles.demo}>{sessionMessage}</Text>}
          <Text style={styles.title} accessibilityRole="header">Volvé a conectar.</Text>
          <Text style={styles.subtitle}>Ingresá para ayudar a que cada objeto y mascota encuentre su camino a casa.</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            editable={!busy} accessibilityLabel="Email"
            placeholder="nombre@ejemplo.com"
            placeholderTextColor="#68756F"
            value={email}
            onChangeText={(value) => { setEmail(value); setErrors({ ...errors, email: undefined }); setMessage(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
          {errors.email && <Text style={styles.error} accessibilityLiveRegion="polite">{errors.email}</Text>}

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={[styles.input, errors.password && styles.inputError]}
            editable={!busy} accessibilityLabel="Contraseña"
            placeholder="Ingresá tu contraseña"
            placeholderTextColor="#68756F"
            value={password}
            onChangeText={(value) => { setPassword(value); setErrors({ ...errors, password: undefined }); setMessage(''); }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            onSubmitEditing={handleLogin}
          />
          {errors.password && <Text style={styles.error} accessibilityLiveRegion="polite">{errors.password}</Text>}

          <TouchableOpacity disabled={busy} style={styles.recover} accessibilityRole="button" onPress={() => navigation.navigate('RecoverPassword')}>
            <Text style={styles.link}>Olvidé mi contraseña</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={busy} style={[styles.primaryButton, busy && { opacity: 0.6 }]} accessibilityRole="button" onPress={handleLogin}>
            <Text style={styles.primaryText}>{busy ? 'Ingresando…' : 'Ingresar'}</Text>
          </TouchableOpacity>
          {!!message && <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text>}

          <View style={styles.separator} />
          <Text style={styles.signupPrompt}>¿Todavía no tenés una cuenta?</Text>
          <TouchableOpacity disabled={busy} style={styles.secondaryButton} accessibilityRole="button" onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8F7' },
  content: { flexGrow: 1, padding: 24, paddingBottom: 40, justifyContent: 'center' },
  form: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  demo: { fontSize: 14, lineHeight: 21, color: '#334E40', marginBottom: 18 },
  brand: { fontSize: 14, letterSpacing: 3, fontWeight: '700', color: '#27634F', marginBottom: 18 },
  title: { fontSize: 32, fontWeight: '700', color: '#173F35', marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24, color: '#52635B', marginBottom: 28 },
  label: { fontSize: 15, fontWeight: '600', color: '#243E34', marginBottom: 8, marginTop: 12 },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#A9B9B0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#FFFFFF', color: '#1B3027' },
  inputError: { borderColor: '#A32929' },
  error: { color: '#A32929', fontSize: 14, marginTop: 6 },
  recover: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-end', marginVertical: 8 },
  link: { color: '#205B46', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  primaryButton: { minHeight: 52, padding: 14, borderRadius: 10, backgroundColor: '#205B46', alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  message: { fontSize: 14, lineHeight: 21, color: '#334E40', backgroundColor: '#E5EEE8', padding: 14, marginTop: 16, borderRadius: 8 },
  separator: { height: 1, backgroundColor: '#D5DFD8', marginVertical: 24 },
  signupPrompt: { fontSize: 15, color: '#52635B', textAlign: 'center', marginBottom: 12 },
  secondaryButton: { minHeight: 52, padding: 14, borderWidth: 1, borderColor: '#205B46', borderRadius: 10, justifyContent: 'center' },
});
