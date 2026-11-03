# Punto 4: detalle de la publicación

Rama `feature/detalle-publicacion`, creada desde `feature/buscador-resultados` (el detalle
se abre desde un resultado de búsqueda y depende del modelo de publicaciones de esa rama).
Agrega la migración `007_publication_follows.sql`.

## Probar desde Android

1. Backend con `npm run dev`, migraciones aplicadas y datos sembrados (`npm run db:migrate`,
   `npm run db:seed -- --owner=tu@email.com`). App con `npx expo start --go --clear`.
2. Desde "Resultados" (punto 3), tocar una publicación: se abre el detalle con galería
   deslizable, insignias de tipo/estado, categoría, barrio, fecha y franja horaria.
3. En una publicación **encontrada** de otra persona: el botón de reclamo dice "Es mío" y
   lleva a un placeholder (el flujo real es el punto 7). En una **perdida**, dice
   "Lo encontré".
4. "Seguir publicación" / "Dejar de seguir": cambia el contador de seguidores y persiste al
   volver a entrar.
5. "Ver perfil público" abre el perfil del punto 2.
6. Iniciando sesión con `--owner`, abrir una publicación propia: no aparecen los botones de
   reclamo ni seguir, sí "Gestionar publicación" (placeholder del punto 5) y la dirección
   exacta ("Dirección exacta (solo vos la ves)"). Con otra cuenta, esa publicación no
   muestra la dirección.
7. Sin conexión: una publicación ya vista se muestra con las fotos guardadas localmente y
   el aviso correspondiente; sin conexión y sin verla antes, informa que no está guardada.

## Endpoints

- `GET /publications/:id`: detalle completo. Autenticación opcional. `exact_location` solo
  si `viewerId` es el publicador; para cualquier otro viewer es `null`. `viewer.can_claim` /
  `can_follow` son `false` para el dueño o si la publicación está resuelta.
- `POST /publications/:id/follow` y `DELETE /publications/:id/follow`: requieren sesión.
  400 si el dueño intenta seguir su propia publicación, 409 si la publicación está resuelta.
  Idempotentes.

## Integración con las partes del grupo

- **Punto 7 (Reclamos)**: `ClaimStart` abre `CreateClaimScreen`. `canSeeExactLocation`
  (`backend/src/publication-access.js`) muestra la dirección exacta a quien publica y a quien
  tiene un reclamo aceptado. El detalle incluye `verification_question` e `is_owner`, que usa
  el formulario de reclamo.
- **Punto 5 (Publicar)**: `ManagePublication` abre "Mis publicaciones".
- **Punto 9 (Alertas y publicaciones seguidas)**: ya integrado (ver `alertas-seguidas.md`).
  La pantalla "Seguidas" lista lo que guarda `publication_follows`. La migración 009 agrega
  `last_seen_status`: "Seguir" guarda el estado actual y abrir este detalle marca la
  publicación seguida como vista, lo que quita el aviso "Cambió de estado". Por eso, desde
  esta rama el detalle necesita la 009 aplicada.
- **Punto 8 (Punto de encuentro)**: el botón "Cómo llegar" no está en este detalle: depende
  de un reclamo aceptado, que todavía no existe.

## Verificación

Desde `backend/`: `npm test` (28 tests con mocks, sin PostgreSQL) y, con la base de
desarrollo disponible, `npm run test:search` (46 comprobaciones contra PostgreSQL
real, incluye búsqueda y detalle). Desde `mobile/`: `node --test "scripts/*.test.mjs"`
(23 tests). Se verificó además contra un PostgreSQL local descartable (Docker) y el bundle
de Expo compila sin errores.
