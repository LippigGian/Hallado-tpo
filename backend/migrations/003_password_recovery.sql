ALTER TABLE public.auth_verifications ADD COLUMN reset_token_hash text;
CREATE UNIQUE INDEX auth_verifications_reset_token_idx ON public.auth_verifications(reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;
ALTER TABLE public.users ADD COLUMN session_version integer NOT NULL DEFAULT 0 CHECK (session_version >= 0);
