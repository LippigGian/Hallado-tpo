export function validateEmail(value) {
  if (!value.trim()) return 'Ingresá tu email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Ingresá un email válido.';
  return '';
}

// Misma longitud admitida por el backend.
export function validatePassword(password, confirmation) {
  if (password.length < 8) return 'Usá al menos 8 caracteres.';
  if (password.length > 128) return 'Usá hasta 128 caracteres.';
  if (!password.trim()) return 'La contraseña no puede contener solo espacios.';
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return '';
}
