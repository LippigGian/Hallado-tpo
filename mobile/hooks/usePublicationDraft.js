import { useEffect, useState } from 'react';
import { clearDraft, loadDraft, saveDraft } from '../services/publicationDraft';
import { emptyForm } from '../utils/publicationValidation';

// Estado del formulario de publicación + borrador automático.
// Cada cambio se guarda en el teléfono; al volver a abrir la pantalla se retoma en el mismo paso.
export function usePublicationDraft(userId) {
  const [loading, setLoading] = useState(true);
  const [restored, setRestored] = useState(false);
  const [form, setForm] = useState(() => emptyForm());
  const [step, setStep] = useState(0);

  useEffect(() => {
    let active = true;
    loadDraft(userId).then(draft => {
      if (!active) return;
      if (draft) {
        setForm({ ...emptyForm(), ...draft.form });
        setStep(draft.step);
        setRestored(true);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (loading) return;
    // Un formulario sin tocar no es un borrador: no hay nada que retomar.
    if (!form.type && step === 0) clearDraft(userId);
    else saveDraft(userId, { step, form });
  }, [loading, userId, form, step]);

  return {
    loading,
    restored,
    form,
    step,
    setStep,
    updateForm: changes => setForm(current => ({ ...current, ...changes })),
    // "Empezar de nuevo": descarta el borrador y deja el formulario vacío.
    discard: () => { setForm(emptyForm()); setStep(0); setRestored(false); },
    // Después de publicar: el borrador ya no hace falta.
    finish: () => clearDraft(userId),
  };
}
