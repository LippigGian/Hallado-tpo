// Nombre que se muestra cuando una persona no cargó el suyo en el perfil.
export const DEFAULT_USER_NAME = 'Vecino de Hallado';

export function displayName(name) {
  return name || DEFAULT_USER_NAME;
}
