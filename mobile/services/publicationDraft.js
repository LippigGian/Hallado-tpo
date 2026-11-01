import AsyncStorage from '@react-native-async-storage/async-storage';

// El borrador no es sensible (no incluye contraseñas ni tokens), por eso va en AsyncStorage y no en SecureStore.
// Se guarda por usuario: otra cuenta en el mismo teléfono no ve el borrador de esta.
const draftKey = userId => `hallado.publicationDraft.${userId}`;

// Devuelve { step, form } o null. Un borrador ilegible se ignora: nunca debe impedir publicar.
export async function loadDraft(userId) {
  try {
    const raw = await AsyncStorage.getItem(draftKey(userId));
    const draft = raw ? JSON.parse(raw) : null;
    return draft && typeof draft.step === 'number' && draft.form ? draft : null;
  } catch {
    return null;
  }
}

export async function saveDraft(userId, draft) {
  try {
    await AsyncStorage.setItem(draftKey(userId), JSON.stringify(draft));
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
