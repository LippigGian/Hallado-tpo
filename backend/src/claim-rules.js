export const CLAIM_RULES = {
  answer: [1, 100],
  neighborhood: [1, 100],
  descriptionMax: 500,
  maxAttempts: 3,
  hoursToExpire: 48,
};

export function claimKindFor(publicationType) {
  return publicationType === 'found' ? 'owner' : 'finder';
}
