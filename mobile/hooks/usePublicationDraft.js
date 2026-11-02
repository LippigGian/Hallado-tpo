import { useEffect, useState } from 'react';
import { clearDraft, loadDraft, saveDraft } from '../services/publicationDraft';
import { emptyForm } from '../utils/publicationValidation';

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
    discard: () => { setForm(emptyForm()); setStep(0); setRestored(false); },
    finish: () => clearDraft(userId),
  };
}
