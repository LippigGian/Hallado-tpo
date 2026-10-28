import { requestRegistrationCode, verifyRegistrationCode, completeRegistration, requestResetCode, verifyResetCode, completePasswordReset } from '../services/authService';
import { getApiError } from '../services/api';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { validateEmail, validatePassword } from '../utils/authValidation';

const CODE_LIFETIME_MS = 5 * 60 * 1000;
const RESEND_DELAY_MS = 30 * 1000;

export default function AuthFlow({ navigation, recovery = false }) {
  const [busy, setBusy] = useState(false);
  const [registrationToken, setRegistrationToken] = useState('');
  const [tokenExpiresAt, setTokenExpiresAt] = useState(0);
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

  async function issueCode() {
    const response = await (recovery ? requestResetCode : requestRegistrationCode)(email.trim().toLowerCase());
    const timestamp = Date.now();
    setIssuedAt(timestamp);
    setNow(timestamp);
    setCode('');
    setRegistrationToken('');
    setTokenExpiresAt(0);
    setError('');
    setNotice(recovery ? 'Si existe una cuenta con ese email, recibirás un código. Revisá también spam.' : 'Revisá tu email y spam. El código vence en 5 minutos.');
    return response;
  }

  async function continueEmail() {
    if (busy) return;
    const validation = validateEmail(email);
    setError(validation);
    if (validation) return;
    setBusy(true);
    try {
      await issueCode();
      setEmail(email.trim().toLowerCase());
      setStep(2);
    } catch (error) { setError(getApiError(error)); }
    finally { setBusy(false); }
  }

  async function resendCode() {
    if (busy || resendSeconds > 0) return;
    setBusy(true);
    try { await issueCode(); }
    catch (error) { setError(getApiError(error)); }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    if (busy) return;
    if (!/^\d{6}$/.test(code)) { setError('Ingresá los 6 dígitos del código.'); return; }
    setBusy(true);
    setError('');
    try {
      const response = await (recovery ? verifyResetCode : verifyRegistrationCode)(email, code);
      setRegistrationToken(recovery ? response.resetToken : response.registrationToken);
      setTokenExpiresAt(Date.now() + response.expiresIn * 1000);
      setCode('');
      setNotice('');
      setStep(3);
    } catch (error) { setError(getApiError(error)); }
    finally { setBusy(false); }
  }

  async function completeAccount() {
    if (busy) return;
    const validation = validatePassword(password, confirmation);
    setError(validation);
    if (validation) return;
    if (Date.now() >= tokenExpiresAt) { setError('El permiso venció. Volvé a solicitar y verificar un código.'); return; }
    setBusy(true);
    try {
      await (recovery ? completePasswordReset : completeRegistration)(registrationToken, password, confirmation);
      setPassword('');
      setConfirmation('');
      setRegistrationToken('');
      setStep(4);
    } catch (error) { setError(getApiError(error)); }
    finally { setBusy(false); }
  }

  function backStep() {
    if (busy) return;
    setRegistrationToken('');
    setTokenExpiresAt(0);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmation('');
    setShowPassword(false);
    if (step === 3) setCode('');
    setStep(1);
  }

  function button(label, onPress, secondary = false, disabled = false) {
    return (
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy}
        onPress={onPress} style={[styles.button, secondary && styles.secondary, (disabled || busy) && styles.disabled]}>
        <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{busy && !secondary ? 'Procesando…' : label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.demo}>{recovery ? 'RECUPERACIÓN · VERIFICACIÓN POR EMAIL' : 'REGISTRO · VERIFICACIÓN POR EMAIL'}</Text>
          {step < 4 && <Text style={styles.progress}>Paso {step} de 3 · {recovery ? 'Recuperar acceso' : 'Crear cuenta'}</Text>}

          {step === 1 && <>
            <Text style={styles.title} accessibilityRole="header">{recovery ? 'Recuperá tu acceso' : 'Sumate a Hallado'}</Text>
            <Text style={styles.description}>{recovery ? 'Ingresá el email de tu cuenta para solicitar un código de recuperación.' : 'Primero vamos a verificar tu email. Después vas a elegir tu contraseña.'}</Text>
            <Text style={styles.label}>Email</Text>
            <TextInput editable={!busy} accessibilityLabel="Email" style={[styles.input, !!error && styles.inputError]} value={email}
              onChangeText={(value) => { setEmail(value); setError(''); }} keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="nombre@ejemplo.com"
              placeholderTextColor="#68756F" onSubmitEditing={continueEmail} />
          </>}

          {step === 2 && <>
            <Text style={styles.title} accessibilityRole="header">Verificá tu email</Text>
            <Text style={styles.description}>{recovery ? `Si la cuenta existe, enviamos un código a ${email}.` : `Ingresá el código enviado a ${email}.`}</Text>
            <Text style={styles.label}>Código de verificación</Text>
            <TextInput editable={!busy} accessibilityLabel="Código de verificación de seis dígitos" style={[styles.input, !!error && styles.inputError]}
              value={code} onChangeText={(value) => { setCode(value.replace(/\D/g, '')); setError(''); }}
              keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor="#68756F" />
            {expired && <Text style={styles.error} accessibilityLiveRegion="polite">El código venció. Solicitá uno nuevo.</Text>}
          </>}

          {step === 3 && <>
            <Text style={styles.title} accessibilityRole="header">{recovery ? 'Elegí una nueva contraseña' : 'Elegí tu contraseña'}</Text>
            <Text style={styles.description}>Cuenta: {email}. Usá entre 8 y 128 caracteres.</Text>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput editable={!busy} accessibilityLabel="Nueva contraseña" style={styles.input} value={password}
              maxLength={128} onChangeText={(value) => { setPassword(value); setError(''); }} secureTextEntry={!showPassword}
              autoCapitalize="none" autoCorrect={false} autoComplete="new-password" />
            <Text style={styles.label}>Confirmar contraseña</Text>
            <TextInput editable={!busy} accessibilityLabel="Confirmar contraseña" style={styles.input} value={confirmation}
              maxLength={128} onChangeText={(value) => { setConfirmation(value); setError(''); }} secureTextEntry={!showPassword}
              autoCapitalize="none" autoCorrect={false} autoComplete="new-password" onSubmitEditing={completeAccount} />
            <TouchableOpacity disabled={busy} style={styles.toggle} accessibilityRole="button" onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.secondaryText}>{showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Text>
            </TouchableOpacity>
          </>}

          {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
          {!!notice && step === 2 && <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text>}
          {step === 1 && button('Enviar código', continueEmail)}
          {step === 2 && <>
            {button('Verificar código', verifyCode)}
            {button(resendSeconds > 0 ? `Reenviar código (${resendSeconds} s)` : 'Reenviar código', resendCode, true, resendSeconds > 0)}
            {button('Cambiar email', backStep, true)}
          </>}
          {step === 3 && <>
            {button(recovery ? 'Cambiar contraseña' : 'Crear cuenta', completeAccount)}
            {button('Solicitar otro código', backStep, true)}
          </>}
          {step === 4 && <>
            <Text style={styles.title} accessibilityRole="header">{recovery ? '¡Contraseña actualizada!' : '¡Cuenta creada!'}</Text>
            <Text style={styles.description}>{recovery ? 'Ya podés iniciar sesión con tu nueva contraseña. Las sesiones anteriores quedaron invalidadas.' : 'Tu cuenta se creó correctamente. Ya podés volver e iniciar sesión.'}</Text>
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
