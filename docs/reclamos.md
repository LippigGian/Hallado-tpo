# Punto 7: reclamos y verificación

Rama `feature/reclamos-verificacion`. Backend (Express + PostgreSQL) y app (React Native + Expo) con las mismas tecnologías del punto 5: React Navigation, Axios, useContext, expo-image-picker y SecureStore.

## Requisitos y cómo se cubren

| Requisito del enunciado | Implementación |
| --- | --- |
| Quien indica "Es mío" responde la pregunta de verificación y puede agregar descripción y foto | `CreateClaimScreen` con tipo de reclamo `owner`. Respuesta obligatoria; descripción y foto opcionales. |
| Quien indica "Lo encontré" adjunta una foto y el barrio donde lo encontró | `CreateClaimScreen` con tipo `finder`. Foto y barrio obligatorios. |
| El publicador acepta o rechaza cada reclamo | `ClaimDetailScreen` con confirmación. `POST /claims/:id/accept` y `/reject`. |
| Máximo 3 intentos por persona y publicación | El servidor cuenta todos los reclamos anteriores (pendientes, rechazados y vencidos). El cuarto devuelve 409. |
| Estados pendiente, aceptado, rechazado y vencido | Columna `claims.status`. |
| Vence a las 48 horas sin respuesta | `claims.expires_at`. El vencimiento se aplica al comenzar cada petición de reclamos o publicaciones (`claim-expiration.js`), sin procesos aparte. |
| "Mis reclamos" con enviados y recibidos, siempre actualizados | `MyClaimsScreen`: dos pestañas, actualiza al entrar, cada 30 segundos y con el gesto de arrastrar hacia abajo. |
| Acciones que requieren conexión deshabilitadas | Enviar, aceptar y rechazar usan `ConnectionRequiredButton` (punto 6). |

El tipo de reclamo lo decide el servidor según la publicación: sobre algo **encontrado** se reclama como dueño (`owner`) y sobre algo **perdido** se avisa que se encontró (`finder`). La app no lo envía.

## Reglas de negocio

- No se puede reclamar la propia publicación (403).
- Solo se reclaman publicaciones abiertas o en reclamo. Si está vencida, resuelta o ya tiene un reclamo aceptado, devuelve 409.
- Un solo reclamo pendiente por persona y publicación (409). Se garantiza también con un índice único en la base.
- La publicación pasa a **En reclamo** mientras tenga algún reclamo pendiente o aceptado, y vuelve a **Abierta** cuando no queda ninguno. Una publicación en reclamo no vence a los 30 días.
- Al aceptar un reclamo, los demás reclamos pendientes de esa publicación se rechazan automáticamente.
- Al aceptar se registra el permiso de contacto con `grantAcceptedClaimContact` (punto 2) dentro de la misma transacción, y quien reclamó pasa a ver la dirección exacta.
- Solo participan del reclamo quien lo envió y quien publicó. Cualquier otra persona recibe 404.

## Endpoints

Todos exigen sesión.

| Método y ruta | Qué hace |
| --- | --- |
| `POST /claims` | Crea un reclamo. 201 con el reclamo. Máximo 30 por hora desde una misma conexión. |
| `GET /claims/mine` | `{ sent, received }`: los enviados y los recibidos, el más nuevo primero. |
| `GET /claims/:id` | Detalle. Solo participantes. |
| `GET /claims/:id/photo` | Foto adjunta. Solo participantes y con sesión: puede ser una prueba de propiedad. |
| `POST /claims/:id/accept` | Acepta. Solo el publicador. 409 si ya fue respondido o venció. |
| `POST /claims/:id/reject` | Rechaza. Solo el publicador. 409 si ya fue respondido o venció. |

Cuerpo de `POST /claims` (los campos fuera de esta lista se rechazan):

```json
{
  "publication_id": "uuid de la publicación",
  "verification_answer": "Azul",
  "description": "Opcional, hasta 500 caracteres",
  "found_neighborhood": "Palermo",
  "photo": "<base64 de un JPEG o PNG de hasta 2 MB>"
}
```

- Sobre una publicación **encontrada**: `verification_answer` obligatoria; `description` y `photo` opcionales; `found_neighborhood` no se acepta.
- Sobre una publicación **perdida**: `photo` y `found_neighborhood` obligatorias; `description` opcional; `verification_answer` no se acepta.

Errores: 400 con `{ "error": "mensaje" }`, 401 sin sesión, 403 al reclamar lo propio, 404, 409 por reglas de negocio y 503 si falla la base.

## Qué ve cada persona

| Dato | Quien publicó | Quien reclamó |
| --- | --- | --- |
| Respuesta recibida, descripción, foto y barrio del reclamo | Sí | Sí (los suyos) |
| `expected_answer` (la respuesta correcta de la publicación) | Sí | **Nunca** |
| Dirección exacta y coordenadas de la publicación | Siempre | Solo con el reclamo **aceptado** |
| Teléfono de la contraparte | Solo si la contraparte lo permite y el reclamo está aceptado | Ídem |

La regla vive en `backend/src/claim-view.js`. `GET /publications/:id` también entrega la dirección exacta a quien tiene un reclamo aceptado.

## Archivos

Backend (`backend/`):

- `migrations/007_claims.sql`: tabla `claims` con restricciones por tipo de reclamo.
- `src/claim-routes.js` (HTTP), `claim-service.js` (consultas y transacciones), `claim-validation.js` (validación), `claim-view.js` (qué ve cada persona), `claim-rules.js` (límites y tipo de reclamo), `claim-expiration.js` (vencimiento y estado de la publicación).
- `src/text-validation.js`: validación de textos compartida con el punto 5.

App (`mobile/`):

- Pantallas: `CreateClaimScreen`, `MyClaimsScreen`, `ClaimDetailScreen`, y `ClaimDemoScreen` (solo para probar).
- `components/claim/*`, `components/PhotoPicker.js` (el selector de fotos del punto 5, ahora reutilizable) y `components/DetailRow.js`.
- `services/claimService.js`, `hooks/useMyClaims.js`, `hooks/useSessionToken.js`.
- `config/claimOptions.js`, `utils/claimValidation.js`, `utils/claimAnswers.js`.

## Integración con las demás partes

- **Detalle de la publicación (punto 4)**: el botón "Es mío" o "Lo encontré" debe llamar a `navigation.navigate('CreateClaim', { publicationId })`. Para decidir si mostrarlo y con qué texto: `isClaimable(publication)`, `claimKindFor(publication.type)` y `CLAIM_ACTION_LABELS`, todos en `config/claimOptions.js`. Cuando exista, se puede quitar `ClaimDemoScreen` y su botón en Inicio.
- **Punto de encuentro (punto 8)**: parte de un reclamo `accepted`. Quien tiene el objeto es el publicador si la publicación es de algo encontrado, y quien reclamó si es de algo perdido (`claim.kind === 'finder'`).
- **Devoluciones y valoraciones (punto 10)**: al concretar la devolución, pasar la publicación a `resolved` y registrar la reputación con `recordReputationEvent` (punto 2).
- **Alertas y seguidas (punto 9)**: pueden basarse en `publications.status` (`claimed` y `resolved`).

## Cómo probar

### 1. Backend sin base de datos

```powershell
cd backend
npm test
```

Deben pasar 26 pruebas.

### 2. Backend contra PostgreSQL

Primero aplicar la migración 007. **La base de Neon es compartida: coordinar con el grupo antes de `npm run db:migrate`.** La migración solo agrega la tabla `claims`.

```powershell
npm run db:migrate
npm run test:claims
```

Hace 86 comprobaciones HTTP/PostgreSQL con usuarios temporales, dentro de una transacción que se revierte.

### 3. App en el emulador (dos cuentas)

Hacen falta una cuenta **A** (publica) y una cuenta **B** (reclama). Se alterna entre ellas cerrando sesión.

Para obtener el identificador de una publicación de A: en el SQL Editor de Neon, `SELECT id, title, type FROM public.publications ORDER BY created_at DESC;`, o `GET /publications/mine` en Postman con el token de A.

| # | Qué hacer | Resultado esperado |
| --- | --- | --- |
| 1 | Con A, publicar un **hallazgo** (pregunta "¿De qué color es el llavero?", respuesta "Azul") y una **pérdida**. | Ambas aparecen en "Mis publicaciones" como Abiertas. |
| 2 | Con A, Inicio → "Reclamar (prueba)" y pegar el id de su propia publicación. | "No podés reclamar tu propia publicación." |
| 3 | Con B, "Reclamar (prueba)" con un texto que no es un id. | Error de formato, sin salir de la pantalla. |
| 4 | Con B, reclamar el hallazgo con la respuesta vacía. | "La respuesta debe tener entre 1 y 100 caracteres." |
| 5 | Con B, reclamar el hallazgo con "azul" y una foto (opcional). | Va al detalle: estado Pendiente y "Vence el" unas 48 horas adelante. |
| 6 | Con B, volver a reclamar el mismo hallazgo. | "Ya tenés un reclamo pendiente en esta publicación." |
| 7 | Con A, "Mis publicaciones". | El hallazgo figura **En reclamo**. |
| 8 | Con A, "Ver reclamos recibidos" (o Inicio → "Mis reclamos" → Recibidos). | Aparece el reclamo de B. Al abrirlo: la pregunta, la respuesta recibida, la respuesta esperada y "Coincide con la respuesta recibida." Si B mandó foto, se ve. |
| 9 | Con A, tocar "Aceptar reclamo" y confirmar. | Estado Aceptado y un recuadro con la dirección exacta y el teléfono de B (o "Prefiere comunicarse solo a través de la app" si no lo comparte). |
| 10 | Con B, "Mis reclamos" → Enviados. | El reclamo figura Aceptado; al abrirlo ve la dirección exacta y el teléfono de A. |
| 11 | Con A, en la **pérdida**, y con B, reclamar con "Lo encontré" sin foto, y luego sin barrio. | Pide la foto y luego el barrio. |
| 12 | Con B, enviar el reclamo completo. Con A, **rechazarlo**. | Con B figura Rechazado. En "Mis publicaciones" de A, la pérdida vuelve a Abierta. |
| 13 | Con B, repetir el reclamo y que A lo rechace, otras dos veces. | Al cuarto intento: "Ya usaste los 3 intentos de reclamo para esta publicación." |
| 14 | Vencimiento: con un reclamo pendiente, en Neon ejecutar `UPDATE public.claims SET expires_at = now() - interval '1 minute' WHERE id = '...';`. Esperar hasta 30 segundos o arrastrar para actualizar. | Figura Vencido, A ya no puede aceptarlo y la publicación vuelve a Abierta. El intento cuenta para el máximo de 3. |
| 15 | Apagar el Wi-Fi del emulador y abrir el reclamo como A. | "Aceptar" y "Rechazar" quedan deshabilitados con el aviso de conexión. |
| 16 | Con una tercera cuenta (Postman), `GET /claims/{id}`. | 404. |

## Decisiones a confirmar con el grupo

- Al aceptar un reclamo se rechazan automáticamente los demás pendientes.
- Cuentan como intento también los reclamos rechazados y vencidos.
- Quien reclamó no puede cancelar su reclamo (el enunciado no lo pide).
- Mientras no exista el detalle de la publicación (punto 4), el reclamo se abre con la pantalla de prueba.

## Limitaciones conocidas

- Verificado: pruebas unitarias, prueba integral contra PostgreSQL y bundle de Android con Metro. **No se probó en un emulador ni en un teléfono.**
- La foto de un reclamo se pide con el token de sesión (`Image` con encabezado `Authorization`). Si no se ve en el emulador, es lo primero a revisar.
