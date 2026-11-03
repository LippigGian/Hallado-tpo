-- Punto 10: devoluciones concretadas. Un registro por caso resuelto: el reclamo aceptado
-- (punto 7) cuyo objeto ya se entregó. Lo confirma quien recupera el objeto, así quien lo
-- devuelve no puede sumarse una devolución a la reputación por su cuenta.
--
-- returner_id: quien devolvió (tenía el objeto: el publicador en "Es mío", quien reclamó en
-- "Lo encontré"). recoverer_id: quien recuperó su objeto. Se guardan para el historial
-- ("Devolví" / "Recuperé") y para el plazo de 7 días de las valoraciones, que corre desde
-- returned_at. Las valoraciones y los agradecimientos van a public.reputation_events (punto 2)
-- con source_id = returns.id. Las reglas las valida la API (return-rules.js).
CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE REFERENCES public.claims(id) ON DELETE CASCADE,
  -- Una publicación se resuelve una sola vez.
  publication_id uuid NOT NULL UNIQUE REFERENCES public.publications(id) ON DELETE CASCADE,
  returner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recoverer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  returned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT returns_different_people CHECK (returner_id <> recoverer_id)
);
CREATE INDEX returns_returner_idx ON public.returns (returner_id, returned_at DESC);
CREATE INDEX returns_recoverer_idx ON public.returns (recoverer_id, returned_at DESC);
