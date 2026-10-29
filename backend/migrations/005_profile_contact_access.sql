-- Proyección de autorización: solo el módulo de reclamos puede registrar/revocar estos permisos.
CREATE TABLE public.claim_contact_access (
  claim_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY(claim_id,owner_id,viewer_id),
  CHECK(owner_id<>viewer_id)
);
