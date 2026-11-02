-- Personas que siguen una publicación para enterarse de sus novedades (punto 4).
-- El listado "Seguidas" y el indicador de novedades son del punto 9: agregar columnas
-- con una migración nueva si hace falta más estado.
-- Que el publicador no se siga a sí mismo lo valida la API (no se puede expresar como CHECK
-- de columna simple sin volver a consultar la tabla de publicaciones).
CREATE TABLE public.publication_follows (
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publication_id, user_id)
);
CREATE INDEX publication_follows_user_idx ON public.publication_follows (user_id, created_at DESC);
