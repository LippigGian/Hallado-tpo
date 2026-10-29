// Se recibe la API del dispositivo para poder probar cancelaciones y ausencia de hardware.
export async function authenticateBiometric(device) {
  const hardware = await device.hasHardwareAsync();
  const enrolled = await device.isEnrolledAsync();
  const types = await device.supportedAuthenticationTypesAsync();
  if (!hardware || !enrolled || !types.length) {
    throw new Error('Configurá una huella o biometría en los ajustes de seguridad del dispositivo. Si no está disponible, ingresá con email y contraseña.');
  }
  const result = await device.authenticateAsync({
    promptMessage: 'Desbloquear Hallado',
    cancelLabel: 'Cancelar',
    disableDeviceFallback: true,
    fallbackLabel: '',
  });
  if (!result.success) {
    const cancelled = ['user_cancel', 'app_cancel', 'system_cancel'].includes(result.error);
    throw new Error(cancelled ? 'Autenticación cancelada. La sesión sigue bloqueada.' : 'No se pudo verificar tu identidad. Reintentá o ingresá con email y contraseña.');
  }
}
