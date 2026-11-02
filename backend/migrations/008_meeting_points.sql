-- Punto 8: acuerdo del punto de encuentro de un reclamo aceptado (punto 7).
-- Quien tiene el objeto propone primero; la otra parte acepta o sugiere otro punto, y así
-- hasta que alguien acepta la última propuesta de la otra persona. Las reglas las valida la API
-- (meeting-point-rules.js); la base garantiza a lo sumo una propuesta aceptada por reclamo.
CREATE TABLE public.meeting_point_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  address text NOT NULL CHECK (char_length(btrim(address)) BETWEEN 5 AND 200),
  schedule text NOT NULL CHECK (char_length(btrim(schedule)) BETWEEN 1 AND 100),
  reference text NOT NULL DEFAULT '' CHECK (char_length(reference) <= 200),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meeting_point_proposals_claim_idx ON public.meeting_point_proposals (claim_id, created_at);
CREATE UNIQUE INDEX meeting_point_proposals_one_accepted_idx ON public.meeting_point_proposals (claim_id) WHERE accepted_at IS NOT NULL;
