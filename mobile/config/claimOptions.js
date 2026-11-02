export const CLAIM_LIMITS = {
  answer: [1, 100],
  neighborhood: [1, 100],
  descriptionMax: 500,
  maxAttempts: 3,
  hoursToExpire: 48,
};

export const CLAIM_STATUS_LABELS = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Vencido',
};

export const CLAIM_TABS = [
  { value: 'sent', label: 'Enviados' },
  { value: 'received', label: 'Recibidos' },
];

export const CLAIM_ACTION_LABELS = {
  owner: 'Es mío',
  finder: 'Lo encontré',
};

export function claimKindFor(publicationType) {
  return publicationType === 'found' ? 'owner' : 'finder';
}

export function isClaimable(publication) {
  return !publication.is_owner && (publication.status === 'open' || publication.status === 'claimed');
}
