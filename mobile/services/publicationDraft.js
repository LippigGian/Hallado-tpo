import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePhoto } from '../utils/photos';

const draftKey = userId => `hallado.publicationDraft.${userId}`;

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
    const photos = draft.form.photos.map(photo => ({ uri: photo.uri }));
    await AsyncStorage.setItem(draftKey(userId), JSON.stringify({ ...draft, form: { ...draft.form, photos } }));
  } catch {
  }
}

export async function clearDraft(userId) {
  try {
    await AsyncStorage.removeItem(draftKey(userId));
  } catch {
  }
}
