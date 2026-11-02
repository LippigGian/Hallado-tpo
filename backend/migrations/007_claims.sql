CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  claimant_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('owner', 'finder')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  verification_answer text CHECK (char_length(verification_answer) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  found_neighborhood text CHECK (char_length(found_neighborhood) BETWEEN 1 AND 100),
  photo_data bytea CHECK (octet_length(photo_data) BETWEEN 1 AND 2097152),
  photo_mime text CHECK (photo_mime IN ('image/jpeg', 'image/png')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '48 hours',
  responded_at timestamptz,
  CONSTRAINT claims_photo_pair CHECK ((photo_data IS NULL) = (photo_mime IS NULL)),
  CONSTRAINT claims_by_kind CHECK (
    (kind = 'owner' AND verification_answer IS NOT NULL AND found_neighborhood IS NULL)
    OR (kind = 'finder' AND found_neighborhood IS NOT NULL AND photo_data IS NOT NULL AND verification_answer IS NULL)
  )
);
CREATE UNIQUE INDEX claims_one_pending_idx ON public.claims (publication_id, claimant_id) WHERE status = 'pending';
CREATE INDEX claims_publication_idx ON public.claims (publication_id, status);
CREATE INDEX claims_claimant_idx ON public.claims (claimant_id, created_at DESC);
CREATE INDEX claims_pending_expiry_idx ON public.claims (expires_at) WHERE status = 'pending';
