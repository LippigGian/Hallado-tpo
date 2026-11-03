-- Punto 9: alertas de búsqueda y novedades de publicaciones seguidas.
--
-- Una alerta guarda los criterios de una búsqueda del punto 3 con la misma semántica que
-- GET /publications: `situation` es lo que le pasó a quien busca (lost = perdí algo) y la
-- alerta coincide con publicaciones del tipo opuesto. Las fechas se guardan siempre como un
-- rango concreto de la fecha del suceso: "Hoy" o "Última semana" se convierten en fechas al
-- guardar, así la alerta no se corre con el paso de los días. `date_preset` solo sirve para
-- mostrar qué opción eligió la persona.
--
-- `last_seen_at` es la última vez que la persona abrió la alerta: las coincidencias creadas
-- después cuentan como nuevas. Las reglas (tope por persona, normalización) las valida la API
-- (alert-validation.js).
CREATE TABLE public.search_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  situation text NOT NULL CHECK (situation IN ('lost', 'found')),
  category text CHECK (category IN ('documents', 'keys', 'electronics', 'pets', 'clothing', 'other')),
  neighborhood text CHECK (char_length(neighborhood) BETWEEN 1 AND 100),
  keywords text CHECK (char_length(keywords) BETWEEN 1 AND 100),
  date_preset text CHECK (date_preset IN ('hoy', '3dias', 'semana', 'rango')),
  date_from date,
  date_to date,
  paused boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_alerts_dates_pair CHECK ((date_from IS NULL) = (date_to IS NULL)),
  CONSTRAINT search_alerts_dates_order CHECK (date_from IS NULL OR date_from <= date_to),
  CONSTRAINT search_alerts_preset_with_dates CHECK ((date_preset IS NULL) = (date_from IS NULL))
);
CREATE INDEX search_alerts_user_idx ON public.search_alerts (user_id, created_at DESC);
-- Una misma persona no puede guardar dos veces la misma búsqueda.
CREATE UNIQUE INDEX search_alerts_same_criteria_idx ON public.search_alerts (
  user_id, situation, coalesce(category, ''), lower(coalesce(neighborhood, '')), lower(coalesce(keywords, '')),
  coalesce(date_from, '-infinity'::date), coalesce(date_to, 'infinity'::date)
);

-- Último estado de la publicación que vio quien la sigue (open, claimed, expired o resolved,
-- como lo muestra la API). Si el estado actual es distinto, la seguida tiene novedad.
-- NULL significa "sin dato" y no cuenta como novedad.
ALTER TABLE public.publication_follows
  ADD COLUMN last_seen_status text CHECK (last_seen_status IN ('open', 'claimed', 'expired', 'resolved'));

-- Las publicaciones que ya se seguían arrancan como vistas en su estado actual, para que al
-- aplicar la migración no aparezcan todas con novedad.
UPDATE public.publication_follows f
   SET last_seen_status = CASE WHEN p.status = 'open' AND p.expires_at <= now() THEN 'expired' ELSE p.status END
  FROM public.publications p
 WHERE p.id = f.publication_id;
