import { api } from './api';
export async function loginRequest(email, password) {
  return (await api.post('/auth/login', { email, password })).data;
}
export async function requestRegistrationCode(email) {
  return (await api.post('/auth/register/request-code', { email })).data;
}
export async function verifyRegistrationCode(email, code) {
  return (await api.post('/auth/register/verify-code', { email, code })).data;
}
export async function completeRegistration(registrationToken, password, passwordConfirmation) {
  return (await api.post('/auth/register/complete', { registrationToken, password, passwordConfirmation })).data;
}

export async function requestResetCode(email) {
  return (await api.post('/auth/password-reset/request-code', { email })).data;
}
export async function verifyResetCode(email, code) {
  return (await api.post('/auth/password-reset/verify-code', { email, code })).data;
}
export async function completePasswordReset(resetToken, password, passwordConfirmation) {
  return (await api.post('/auth/password-reset/complete', { resetToken, password, passwordConfirmation })).data;
}
