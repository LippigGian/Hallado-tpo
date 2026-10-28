import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { validateEmail, validatePassword } from '../utils/authValidation';

// Simulación local de navegación: no envía emails ni crea usuarios o sesiones.
const DEMO_CODE = '123456';
const CODE_LIFETIME_MS = 5 * 60 * 1000;
const RESEND_DELAY_MS = 30 * 1000;

export default function AuthFlow({ navigation, recovery = false }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [issuedAt, setIssuedAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (step !== 2) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const resendSeconds = Math.max(0, Math.ceil((issuedAt + RESEND_DELAY_MS - now) / 1000));
  const expired = issuedAt > 0 && now >= issuedAt + CODE_LIFETIME_MS;

  function issueDemoCode() {
    const timestamp = Date.now();
    setIssuedAt(timestamp);
    setNow(timestamp);
    setCode('');
    setError('');
    setNotice('Código de prueba: 123456. No se envió ningún email. Vence en 5 minutos.');
  }

  function continueEmail() {
    const validation = validateEmail(email);
    setError(validation);
    if (validation) return;
    setEmail(email.trim());
    issueDemoCode();
    setStep(2);
  }

  function verifyCode() {
    if (Date.now() >= issuedAt + CODE_LIFETIME_MS) {
      setError('El código venció. Solicitá uno nuevo.');
    } else if (!/^\d{6}$/.test(code)) {
      setError('Ingresá los 6 dígitos del código.');
    } else if (code !== DEMO_CODE) {
      setError('El código de prueba no coincide. Usá 123456.');
    } else {
      setError('');
      setNotice('');
      setStep(3);
    }
  }

  function completeDemo() {
    const validation = validatePassword(password, confirmation);
    setError(validation);
    if (validation) return;
    // No persistir ni enviar contraseñas hasta implementar la API.
    setPassword('');
    setConfirmation('');
    setStep(4);
  }

  function backStep() {
    setError('');
    setNotice('');
    setPassword('');
    setConfirmation('');
    setShowPassword(false);
    if (step === 3) setCode('');
    setStep(step - 1);
  }

  function button(label, onPress, secondary = false, disabled = false) {
    return (
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
        onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
        <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.demo}>DEMOSTRACIÓN · SIN CONEXIÓN A LA API</Text>
          {step < 4 && <Text style={styles.progress}>Paso {step} de 3 · {recovery ? 'Recuperar acceso' : 'Crear cuenta'}</Text>}

          {step === 1 && <>
            <Text style={styles.title} accessibilityRole="header">{recovery ? 'Recuperá tu acceso' : 'Sumate a Hallado'}</Text>
            <Text style={styles.description}>{recovery ? 'Ingresá el email de tu cuenta para comenzar la recuperación.' : 'Primero vamos a verificar tu email. Después vas a elegir tu contraseña.'}</Text>
            <Text style={styles.label}>Email</Text>
            <TextInput accessibilityLabel="Email" style={[styles.input, !!error && styles.inputError]} value={email}
              onChangeText={(value) => { setEmail(value); setError(''); }} keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="nombre@ejemplo.com"
              placeholderTextColor="#68756F" onSubmitEditing={continueEmail} />
          </>}

          {step === 2 && <>
            <Text style={styles.title} accessibilityRole="header">Verificá tu email</Text>
            <Text style={styles.description}>En el flujo real enviaremos un código a {email}.</Text>
            <Text style={styles.label}>Código de verificación</Text>
            <TextInput accessibilityLabel="Código de verificación de seis dígitos" style={[styles.input, !!error && styles.inputError]}
              value={code} onChangeText={(value) => { setCode(value.replace(/\D/g, '')); setError(''); }}
              keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor="#68756F" />
            {expired && <Text style={styles.error} accessibilityLiveRegion="polite">El código de prueba venció. Solicitá uno nuevo.</Text>}
          </>}

          {step === 3 && <>
            <Text style={styles.title} accessibilityRole="header">{recovery ? 'Nueva contraseña' : 'Elegí tu contraseña'}</Text>
            <Text style={styles.description}>Cuenta: {email}. Usá al menos 8 caracteres. Esta regla es provisional hasta definir la API.</Text>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput accessibilityLabel="Nueva contraseña" style={styles.input} value={password}
              onChangeText={(value) => { setPassword(value); setError(''); }} secureTextEntry={!showPassword}
              autoCapitalize="none" autoCorrect={false} autoComplete="new-password" />
            <Text style={styles.label}>Confirmar contraseña</Text>
            <TextInput accessibilityLabel="Confirmar contraseña" style={styles.input} value={confirmation}
              onChangeText={(value) => { setConfirmation(value); setError(''); }} secureTextEntry={!showPassword}
              autoCapitalize="none" autoCorrect={false} autoComplete="new-password" onSubmitEditing={completeDemo} />
            <TouchableOpacity style={styles.toggle} accessibilityRole="button" onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.secondaryText}>{showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Text>
            </TouchableOpacity>
          </>}

          {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
          {!!notice && step === 2 && <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text>}
          {step === 1 && button('Continuar en modo demo', continueEmail)}
          {step === 2 && <>
            {button('Validar código de prueba', verifyCode)}
            {button(resendSeconds > 0 ? `Reenviar código (${resendSeconds} s)` : 'Reenviar código de prueba', issueDemoCode, true, resendSeconds > 0)}
            {button('Cambiar email', backStep, true)}
          </>}
          {step === 3 && <>
            {button(recovery ? 'Simular cambio de contraseña' : 'Simular registro', completeDemo)}
            {button('Volver a verificar código', backStep, true)}
          </>}
          {step === 4 && <>
            <Text style={styles.title} accessibilityRole="header">Recorrido completado</Text>
            <Text style={styles.description}>{recovery
              ? 'Probaste el flujo de recuperación. No se modificó ninguna contraseña.'
              : 'Probaste el flujo de registro. No se creó ninguna cuenta.'} Cuando conectemos la API, estas acciones se realizarán en el servidor.</Text>
            {button('Volver al inicio de sesión', () => navigation.popToTop())}
          </>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8F7' },
  content: { flexGrow: 1, padding: 24, paddingBottom: 40, justifyContent: 'center' },
  form: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  demo: { color: '#334E40', backgroundColor: '#E5EEE8', padding: 12, borderRadius: 8, fontSize: 12, fontWeight: '700', lineHeight: 18, marginBottom: 20 },
  progress: { color: '#52635B', fontSize: 14, marginBottom: 12 },
  title: { color: '#173F35', fontSize: 28, fontWeight: '700', marginBottom: 14 },
  description: { color: '#52635B', fontSize: 16, lineHeight: 24, marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '600', color: '#243E34', marginTop: 12, marginBottom: 8 },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#A9B9B0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#FFFFFF', color: '#1B3027' },
  inputError: { borderColor: '#A32929' },
  error: { color: '#A32929', fontSize: 14, lineHeight: 21, marginTop: 10 },
  notice: { color: '#334E40', fontSize: 14, lineHeight: 21, marginTop: 12 },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: '#205B46', padding: 14, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondary: { backgroundColor: '#F6F8F7', borderWidth: 1, borderColor: '#205B46' },
  secondaryText: { color: '#205B46', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  toggle: { minHeight: 48, justifyContent: 'center', marginTop: 8 },
});
