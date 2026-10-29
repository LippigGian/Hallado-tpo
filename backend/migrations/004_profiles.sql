ALTER TABLE public.users
  ADD COLUMN name text NOT NULL DEFAULT '' CHECK (char_length(name) <= 80),
  ADD COLUMN neighborhood text NOT NULL DEFAULT '' CHECK (char_length(neighborhood) <= 100),
  ADD COLUMN phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 30),
  ADD COLUMN share_phone_after_claim boolean NOT NULL DEFAULT false,
  ADD COLUMN photo_data bytea,
  ADD COLUMN photo_mime text CHECK (photo_mime IN ('image/jpeg','image/png')),
  ADD COLUMN profile_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT profile_photo_pair CHECK ((photo_data IS NULL) = (photo_mime IS NULL)),
  ADD CONSTRAINT profile_photo_size CHECK (photo_data IS NULL OR octet_length(photo_data) <= 1048576);

-- Proyección de reputación: la alimentan módulos del servidor, nunca la app.
-- source_id identifica el caso/valoración original; no duplicar un mismo evento.
CREATE TABLE public.reputation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('return','rating','thanks')),
  source_id uuid NOT NULL,
  author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  value integer NOT NULL DEFAULT 1,
  message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reputation_event_value CHECK ((event_type='rating' AND value IN (-1,1)) OR (event_type IN ('return','thanks') AND value=1)),
  CONSTRAINT reputation_not_self CHECK (author_id IS NULL OR author_id<>user_id),
  UNIQUE(user_id,event_type,source_id)
);
CREATE INDEX reputation_events_user_idx ON public.reputation_events(user_id,created_at DESC);
