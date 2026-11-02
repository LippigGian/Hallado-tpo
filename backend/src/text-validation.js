export function isMissing(value) {
  return value === undefined || value === null || value === '';
}

export function textError(value, label, [min, max]) {
  if (typeof value !== 'string') return `Completá ${label}.`;
  const length = value.trim().length;
  const sentence = label.charAt(0).toUpperCase() + label.slice(1);
  return length < min || length > max ? `${sentence} debe tener entre ${min} y ${max} caracteres.` : '';
}
