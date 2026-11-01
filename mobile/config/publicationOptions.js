// Opciones y límites compartidos por el alta de publicaciones (punto 5) y por las pantallas que
// las muestran o filtran (buscador, detalle, reclamos). Los valores `value` son los que guarda la API.

export const PUBLICATION_TYPES = [
  { value: 'lost', label: 'Perdí algo', description: 'Quiero que me ayuden a encontrarlo.' },
  { value: 'found', label: 'Encontré algo', description: 'Quiero devolverlo a su dueño.' },
];

export const CATEGORIES = [
  { value: 'documents', label: 'Documentos' },
  { value: 'keys', label: 'Llaves' },
  { value: 'electronics', label: 'Electrónica' },
  { value: 'pets', label: 'Mascotas' },
  { value: 'clothing', label: 'Ropa' },
  { value: 'other', label: 'Otros' },
];

export const STATUS_LABELS = {
  open: 'Abierta',
  claimed: 'En reclamo',
  resolved: 'Resuelta',
  expired: 'Vencida',
};

// Mismos límites que valida el backend (backend/src/publication-validation.js).
export const LIMITS = {
  title: [3, 80],
  description: [10, 1000],
  neighborhood: [1, 100],
  address: [3, 200],
  question: [5, 200],
  answer: [1, 100],
  maxPhotos: 5,
  maxPhotoBytes: 2 * 1024 * 1024,
  maxPastDays: 365,
};

export const STEP_TITLES = {
  type: '¿Qué pasó?',
  photos: 'Fotos',
  details: 'Detalles',
  location: '¿Dónde fue?',
  verification: 'Pregunta de verificación',
};

// La pregunta de verificación solo existe al publicar algo encontrado.
export function stepsFor(type) {
  const steps = ['type', 'photos', 'details', 'location'];
  return type === 'found' ? [...steps, 'verification'] : steps;
}

export function labelOf(options, value) {
  return options.find(option => option.value === value)?.label ?? value;
}
