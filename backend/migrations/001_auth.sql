-- Usuarios registrados: se crea el usuario al completar email y contraseña.
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(btrim(email)) AND email <> ''),
  password_hash text NOT NULL CHECK (length(password_hash) > 0),
  email_verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

-- Puede existir una verificación de registro antes de existir un usuario.
-- El servidor calculará un HMAC del OTP usando un secreto; nunca guardar el código legible.
CREATE TABLE public.auth_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(btrim(email)) AND email <> ''),
  purpose text NOT NULL CHECK (purpose IN ('register', 'password_reset')),
  code_hash text NOT NULL CHECK (length(code_hash) > 0),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  used_at timestamptz,
  CONSTRAINT verification_attempts_valid CHECK (attempts >= 0 AND attempts <= max_attempts),
  CONSTRAINT verification_expiration_valid CHECK (expires_at > created_at),
  CONSTRAINT verification_verified_valid CHECK (verified_at IS NULL OR verified_at >= created_at),
  CONSTRAINT verification_used_valid CHECK (used_at IS NULL OR (verified_at IS NOT NULL AND used_at >= verified_at))
);
CREATE INDEX auth_verifications_email_purpose_created_idx
  ON public.auth_verifications (email, purpose, created_at DESC);
CREATE INDEX auth_verifications_expires_idx ON public.auth_verifications (expires_at);
