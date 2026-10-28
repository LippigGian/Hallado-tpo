ALTER TABLE public.auth_verifications
  ADD COLUMN registration_token_hash text;
CREATE UNIQUE INDEX auth_verifications_registration_token_idx
  ON public.auth_verifications (registration_token_hash)
  WHERE registration_token_hash IS NOT NULL;
