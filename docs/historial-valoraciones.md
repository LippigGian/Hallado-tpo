# Punto 10: historial y valoraciones

Cuando quien recupera el objeto confirma la devolución, el caso queda resuelto y aparece en el Historial de las dos personas: en "Devolví" para quien lo devolvió y en "Recuperé" para quien lo recuperó. Durante los 7 días siguientes, cada parte puede valorar a la otra y quien recuperó puede dejar un agradecimiento público. Rama `feature/historial-valoraciones`. Agrega la migración `010_returns.sql`.

> **Con esta rama, todas las rutas de reclamos necesitan la 010 aplicada**, porque `SELECT_CLAIM` (`claim-service.js`) hace `LEFT JOIN public.returns`. Sin ella, ver o listar reclamos responde 503.

## Requisitos y cómo se cubren

| Requisito | Implementación |
| --- | --- |
| Historial de casos resueltos, separado en "Devolví" y "Recuperé", con fecha, objeto y contraparte | `GET /history` → `{ returned, recovered }`. `HistoryScreen` con dos pestañas; cada caso (`HistoryCard`) muestra la foto, la categoría, el objeto, "Devolviste a Ana el 01/11/2026" o "Ana te lo devolvió el 01/11/2026" y el enlace al perfil de la contraparte. |
| Filtros por rango de fechas y por tipo | Período con opciones predeterminadas ("Último mes", "Últimos 3 meses", "Este año", "Todo"), que el backend convierte en una fecha concreta. "Tipo" se interpretó como la **categoría** del objeto. |
| Dentro de los 7 días de la devolución, cada parte puede valorar a la otra (positiva o negativa) con un mensaje corto opcional | `POST /history/:id/rating` + `HistoryFeedbackScreen`. Una valoración por parte y por caso, sin edición, con un mensaje de hasta 200 caracteres. |
| Quien recuperó puede dejar un agradecimiento público, visible en el perfil de quien devolvió | `POST /history/:id/thanks`. Se muestra en el perfil público, que ya listaba los agradecimientos (punto 2). |
| Las valoraciones recibidas alimentan la reputación | Se guardan como `reputation_events` (`rating`, `thanks`), igual que la devolución (`return`). El puntaje del perfil las suma solo. |

## Reglas

- **Quién devuelve y quién recupera:** devuelve quien tiene el objeto, con la misma regla que el punto de encuentro (punto 8). En "Es mío" (publicación de algo encontrado), devuelve quien publicó y recupera quien reclamó. En "Lo encontré" (publicación de algo perdido), es al revés.
- **Confirmar la devolución:**
  - La confirma **quien recupera**, sobre un reclamo **aceptado**. No hace falta haber acordado el punto de encuentro.
  - Se confirma una sola vez por reclamo y por publicación.
  - En la misma transacción: crea el caso en `returns`, pasa la publicación a `resolved` y suma `return` a la reputación de quien devolvió.
- **Plazo:** valoraciones y agradecimientos se aceptan mientras `now() < returned_at + 7 días`.
- **Valoración:**
  - Cada parte valora a la otra, positiva (+1) o negativa (−1).
  - El mensaje es opcional, de hasta 200 caracteres.
  - Una sola por parte y por caso, sin edición.
- **Agradecimiento:**
  - Solo de quien recuperó a quien devolvió, con mensaje obligatorio de hasta 200 caracteres.
  - Uno por caso, sin edición.
  - Tiene el mismo plazo de 7 días.
- **Reputación (punto 2):**
  - Puntaje = devoluciones + positivas − negativas.
  - Los agradecimientos no suman puntos; se muestran en el perfil.
  - `reputation_events` ya impedía duplicados (`UNIQUE(user_id, event_type, source_id)`) y la autovaloración.
- **Fechas del filtro:** se calculan con la hora de Argentina, igual que el buscador.
  - "Último mes" el 03/11 incluye desde el 03/10; "Últimos 3 meses", desde el 03/08; "Este año", desde el 01/01.
  - Si el día no existe en el mes de destino, se usa el último día del mes: el 31/03, "Último mes" empieza el 28/02.

## Backend

- Migración `010_returns.sql`:
  - Tabla `returns` con `claim_id` (único), `publication_id` (único), `returner_id`, `recoverer_id` y `returned_at`, más la restricción `returner_id <> recoverer_id`.
  - Un índice por persona y fecha para cada pestaña.
  - Las valoraciones y los agradecimientos no tienen tabla propia: van a `reputation_events` con `source_id = returns.id`. Como `user_id` es la persona valorada, el índice único admite una valoración en cada dirección.
- `src/return-rules.js`: `returnerId`, `recovererId`, `returnOutcome` y `serializeReturn` (el campo `return` del reclamo).
- `src/return-service.js`: `confirmReturn`. Bloquea el reclamo y la publicación (`FOR UPDATE`), así que dos confirmaciones simultáneas no crean dos casos.
- `src/history-rules.js`: `parseHistoryQuery` (período y categoría), `periodStart` y `serializeHistoryItem`.
- `src/history-service.js`: una consulta por pestaña. Incluye la contraparte, la foto de portada, el plazo y las valoraciones y el agradecimiento del caso.
- `src/feedback-rules.js` y `src/feedback-service.js`: validación, permisos, plazo y alta del evento de reputación.
- Endpoints (todos con sesión):
  - `POST /claims/:id/return` → `{ claim }`. Errores: 400 si el id no es válido, 404 si no participás, 403 si sos quien devuelve, 409 si el reclamo no está aceptado o la devolución ya se confirmó.
  - Todo reclamo (`GET /claims/:id`, `GET /claims/mine`) incluye `return: { returned, returned_at, role: 'devuelve'|'recupera', can_confirm }`.
  - `GET /history?period=mes|3meses|anio|todo&category=` → `{ filters: { period, date_from, category }, returned: [...], recovered: [...] }`.
    - Cada caso trae `{ id, claim_id, returned_at, publication: { id, type, title, category, cover_photo_url }, counterpart: { id, name }, feedback }`.
    - `feedback` es `{ until, open, given_rating, received_rating, thanks, can_rate, can_thank }`.
    - Como máximo 100 casos por pestaña, los más recientes primero.
  - `POST /history/:id/rating` con `{ value: 'positive'|'negative', message? }` → 201. Errores: 400, 404, 409 si ya valoraste o pasaron 7 días.
  - `POST /history/:id/thanks` con `{ message }` → 201. Errores: 400, 403 si no sos quien recuperó, 404, 409 si ya agradeciste o pasaron 7 días.
- Pruebas:
  - `npm test` corre `test/returns.test.js` y `test/history.test.js` con mocks.
  - `npm run test:returns` corre contra PostgreSQL dentro de una transacción que se deshace. Con `-- --with-migration` aplica la 010 solo dentro de esa transacción.

## App

- `services/claimService.js` (`confirmReturn`) y `services/historyService.js` (`getHistory`, `rateCase`, `thankCase`).
- `services/history/historyView.js`: funciones puras (textos, períodos y validación de formularios), testeadas en `scripts/history.test.mjs`.
- `components/claim/ClaimReturnSection.js`: en el detalle de un reclamo aceptado.
  - Quien recupera ve **Confirmar devolución**, con un aviso previo.
  - Quien devuelve ve "Devolución pendiente".
  - Ya confirmada, los dos ven "Devolución concretada" y el botón **Ir al historial**.
  - Después de confirmar se oculta la sección del punto de encuentro, y el reclamo se muestra como **"Devuelto"** (`ClaimStatusBadge`, también en Mis reclamos).
- `screens/HistoryScreen.js` (Menú → Historial):
  - Pestañas con la cantidad de casos y filtros de período y categoría.
  - Se recarga al cambiar un filtro, al volver del formulario o al deslizar hacia abajo.
- `components/history/HistoryCard.js`:
  - Muestra tu valoración, la recibida y el agradecimiento.
  - Muestra "Podés hacerlo hasta el …" o avisa que el plazo venció.
  - Tiene los botones **Valorar a …** y, en "Recuperé", **Dejar un agradecimiento**.
- `screens/HistoryFeedbackScreen.js`: 👍/👎 con mensaje opcional para valorar, o mensaje obligatorio para agradecer. Tiene un contador de caracteres y avisa que no se puede editar.
- **Sin conexión (punto 6):** el historial avisa que necesita internet. Confirmar, valorar y agradecer usan `ConnectionRequiredButton`.

## Probar desde Android

1. Aplicar la migración (coordinarlo con el grupo): `npm run db:migrate` en `backend/`. Después `npm run dev`, y `npx expo start --go --clear` en `mobile/`.
2. Con una cuenta B, publicar un hallazgo. Con una cuenta C, reclamarlo con "Es mío". Con B, aceptar el reclamo.
3. Con B, en el detalle del reclamo aparece "Devolución pendiente".
4. Con C, en el detalle aparece "¿Ya lo recuperaste?". Tocar **Confirmar devolución** y aceptar el aviso. El reclamo pasa a "Devuelto", desaparece el punto de encuentro y la publicación queda "Resuelta".
5. Con C, ir a Menú → Historial → "Recuperé". Aparece el caso con "B te lo devolvió el …".
6. Con C, valorar a B y dejar un agradecimiento. Los botones desaparecen y el caso muestra lo enviado.
7. Con B, ir a Historial → "Devolví". Aparecen la valoración recibida y el agradecimiento. Valorar a C.
8. Abrir el perfil público de B: muestra 1 devolución, 1 valoración positiva (si C la dejó positiva) y el agradecimiento.
9. Probar los filtros: con "Electrónica" el caso de llaves no aparece, y con "Último mes" sí.

## Integración con las demás partes

- **Reclamos (punto 7):** la devolución parte de un reclamo `accepted`. `serializeClaim` agrega el campo `return`.
- **Punto de encuentro (punto 8):** comparte la regla de quién tiene el objeto. No es requisito para confirmar. Después de la devolución, la app oculta la sección y el backend responde 409 a proponer y a aceptar (`already_returned` en `meeting-point-rules.js`). `GET /meeting-point` sigue respondiendo, con `puedeProponer` y `puedeResponder` en `false`.
- **Perfil y reputación (punto 2):** se usa `recordReputationEvent` dentro de la transacción de cada caso de uso. No hubo que cambiar `readReputation` ni `ProfileSummary`.
- **Alertas y seguidas (punto 9):** quien sigue la publicación ve el cambio a "Resuelta" sin cambios en ese punto.

## Decisiones tomadas

- La devolución la confirma quien recupera; no hace falta confirmación de las dos partes.
- "Tipo" en los filtros es la categoría del objeto.
- El agradecimiento tiene el mismo plazo de 7 días que la valoración.
- Alcanza con un reclamo aceptado; el punto de encuentro no es obligatorio.
- Una valoración por parte y por caso, sin edición, con mensaje opcional de hasta 200 caracteres.
- Con la devolución confirmada, no se puede proponer ni aceptar punto de encuentro (409).

## Verificación

- Desde `backend/`: `npm test`, 88 tests con mocks y sin PostgreSQL.
- Contra Neon: la 010 está aplicada. `npm run test:returns` pasó las 39 comprobaciones; `test:meeting-point` (24) y `test:claims` (86) siguen pasando. Todo corre dentro de transacciones que se deshacen.
- Desde `mobile/`: `node --test "scripts/*.test.mjs"`, 52 tests. `npx expo lint` da los mismos 3 errores previos de `AuthFlow.js` que hay en `main`, y `npx expo export --platform android` compila.
- **Pendiente:** probar en el emulador siguiendo "Probar desde Android".
