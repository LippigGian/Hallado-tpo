-- Publicaciones de objetos/mascotas perdidos o encontrados.
-- El alta, edición, renovación y resolución las implementa el punto 5; acá se define
-- el modelo que leen el buscador (punto 3) y el detalle (punto 4).
CREATE TABLE public.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('lost','found')),
  category text NOT NULL CHECK (category IN ('documents','keys','electronics','pets','clothing','other')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  neighborhood text NOT NULL CHECK (char_length(btrim(neighborhood)) BETWEEN 2 AND 100),
  occurred_on date NOT NULL,
  -- Franja horaria del suceso; NULL si la persona no la recuerda.
  time_slot text CHECK (time_slot IN ('early_morning','morning','afternoon','night')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_claim','resolved')),
  -- Ubicación exacta: privada. Solo la ve el publicador (y, con el punto 7, la contraparte de un reclamo aceptado).
  exact_address text NOT NULL DEFAULT '' CHECK (char_length(exact_address) <= 200),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  -- Coordenadas públicas (~1 km): calculadas por la base para que nunca se publique el punto exacto.
  approx_latitude double precision GENERATED ALWAYS AS (round(latitude::numeric, 2)::double precision) STORED,
  approx_longitude double precision GENERATED ALWAYS AS (round(longitude::numeric, 2)::double precision) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Buscador: tipo opuesto + estado visible, ordenado por fecha del suceso.
CREATE INDEX publications_search_idx ON public.publications (type, status, occurred_on DESC, created_at DESC);
CREATE INDEX publications_category_idx ON public.publications (type, category, occurred_on DESC);
CREATE INDEX publications_neighborhood_idx ON public.publications (lower(neighborhood), type);
-- "Mis publicaciones" (punto 5).
CREATE INDEX publications_publisher_idx ON public.publications (publisher_id, created_at DESC);
-- Cercanía: distancia calculada en la consulta sobre coordenadas aproximadas. Con volumen real, migrar a PostGIS.

-- Fotos en bytea como los avatares (sin almacenamiento de objetos). Hasta 5 por publicación.
CREATE TABLE public.publication_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 4),
  photo_data bytea NOT NULL CHECK (octet_length(photo_data) BETWEEN 1 AND 1048576),
  photo_mime text NOT NULL CHECK (photo_mime IN ('image/jpeg','image/png')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publication_id, position)
-- Punto 5: publicaciones de objetos o mascotas perdidas (lost) o encontradas (found).
-- Otros puntos del TP leen esta tabla (buscador, detalle, reclamos, alertas): no cambiar sus nombres sin avisar.
--
-- status guarda solo lo que decide el sistema: open, claimed (en reclamo) o resolved.
-- "Vencida" no se guarda: una publicación open con expires_at en el pasado se muestra como expired.
-- Así no hace falta un proceso que marque los vencimientos, y renovar es solo mover expires_at.
CREATE TABLE public.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('lost', 'found')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 1000),
  category text NOT NULL CHECK (category IN ('documents', 'keys', 'electronics', 'pets', 'clothing', 'other')),
  occurred_at timestamptz NOT NULL,
  neighborhood text NOT NULL CHECK (char_length(neighborhood) BETWEEN 1 AND 100),
  -- Dirección exacta: solo la ve quien publica (y, en el punto 7, quien tenga un reclamo aceptado).
  address text NOT NULL CHECK (char_length(address) BETWEEN 3 AND 200),
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  -- Solo los objetos encontrados llevan pregunta de verificación. La respuesta es privada.
  verification_question text CHECK (char_length(verification_question) BETWEEN 5 AND 200),
  verification_answer text CHECK (char_length(verification_answer) BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'resolved')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT publications_coordinates_pair CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CONSTRAINT publications_verification_by_type CHECK (
    (type = 'found' AND verification_question IS NOT NULL AND verification_answer IS NOT NULL)
    OR (type = 'lost' AND verification_question IS NULL AND verification_answer IS NULL)
  )
);
CREATE INDEX publications_user_idx ON public.publications (user_id, created_at DESC);
CREATE INDEX publications_search_idx ON public.publications (status, type, occurred_at DESC);

-- Fotos guardadas en la base, igual que la foto de perfil, para que las APIs locales de todo el grupo las compartan.
-- Si el proyecto crece, conviene moverlas a almacenamiento de objetos.
CREATE TABLE public.publication_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  sort_order smallint NOT NULL CHECK (sort_order BETWEEN 0 AND 4),
  mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png')),
  data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 2097152),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publication_id, sort_order)
);
