import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePhoto } from '../utils/photos';

// El borrador no es sensible (no incluye contraseñas ni tokens), por eso va en AsyncStorage y no en SecureStore.
// Se guarda por usuario: otra cuenta en el mismo teléfono no ve el borrador de esta.
const draftKey = userId => `hallado.publicationDraft.${userId}`;

// Devuelve { step, form } o null. Un borrador ilegible se ignora: nunca debe impedir publicar.
export async function loadDraft(userId) {
  try {
    const raw = await AsyncStorage.getItem(draftKey(userId));
    const draft = raw ? JSON.parse(raw) : null;
    if (!draft || typeof draft.step !== 'number' || !draft.form) return null;
    return { ...draft, form: { ...draft.form, photos: (draft.form.photos ?? []).map(normalizePhoto) } };
  } catch {
    return null;
  }
}

export async function saveDraft(userId, draft) {
  try {
    // De las fotos solo se guarda la URI: el base64 puede pesar varios MB y AsyncStorage tiene un tope.
    const photos = draft.form.photos.map(photo => ({ uri: photo.uri }));
    await AsyncStorage.setItem(draftKey(userId), JSON.stringify({ ...draft, form: { ...draft.form, photos } }));
  } catch {
    // Sin borrador se puede seguir cargando la publicación.
  }
}

export async function clearDraft(userId) {
  try {
    await AsyncStorage.removeItem(draftKey(userId));
  } catch {
    // Nada para hacer: el próximo guardado lo reemplaza.
  }
}
