# Punto 8: devolución y punto de encuentro

Una vez aceptado un reclamo (punto 7), las dos personas acuerdan dónde y cuándo devolver el objeto desde el detalle del reclamo, y usan "Cómo llegar" para ir al lugar.

## Requisitos y cómo se cubren

| Requisito | Implementación |
| --- | --- |
| Una vez aceptado el reclamo, quien tiene el objeto propone el punto de encuentro | `POST /claims/:id/meeting-point/proposals`. La primera propuesta solo la puede hacer quien tiene el objeto: quien publicó si la publicación es de algo encontrado ("Es mío"), o quien reclamó si es de algo perdido ("Lo encontré"). |
| La otra parte puede aceptarlo o sugerir uno alternativo | `POST .../accept` acepta la última propuesta; una nueva propuesta de la otra persona es la alternativa. Por turnos, hasta que alguien acepta la última propuesta de la otra. |
| Botón "Cómo llegar" que abre Google Maps (o la app de mapas por defecto) en modo navegación | `ComoLlegarButton` → `abrirComoLlegar()` en `directions.js`. Android: `google.navigation:q=` → `geo:` → Google Maps web. iOS: Google Maps → Apple Maps → web. |

## Backend

- Migración `008_meeting_points.sql`: tabla `meeting_point_proposals` (reclamo, quién propone, dirección 5 a 200 caracteres, día y horario, referencia opcional, `accepted_at`). Un índice único garantiza a lo sumo una propuesta aceptada por reclamo.
- `src/meeting-point-rules.js`: reglas puras (quién tiene el objeto, turnos, validación y vista).
- `src/meeting-point-service.js`: consultas; proponer y aceptar bloquean el reclamo (`FOR UPDATE`) para que dos respuestas simultáneas no se pisen.
- Rutas en `src/claim-routes.js` (sesión obligatoria, solo las dos partes del reclamo):
  - `GET /claims/:id/meeting-point` → `{ meeting_point: { estado, rol, puedeProponer, puedeResponder, propuestas, aceptado } }`. `estado`: `sin_propuesta`, `propuesto` o `aceptado`; `rol`: `tiene_objeto` u `otra_parte`.
  - `POST /claims/:id/meeting-point/proposals` con `{ direccion, horario, referencia? }` → 201. 400 si los datos son inválidos; 409 si el reclamo no está aceptado, si ya hay acuerdo, si no le toca proponer a esa persona o si es la primera propuesta y no tiene el objeto, o si la devolución ya fue confirmada (punto 10).
  - `POST /claims/:id/meeting-point/accept` → 200. 409 si no hay propuesta, si es la propia, si ya se acordó o si la devolución ya fue confirmada.
- Pruebas: `npm test` (`test/meeting-point.test.js`) y, con la 008 aplicada, `npm run test:meeting-point` contra PostgreSQL (todo dentro de una transacción que se deshace).

## App

- `components/meetingPoint/MeetingPointSection.js`: sección "Punto de encuentro" del detalle de un reclamo aceptado (`ClaimDetailScreen`). Muestra el formulario, la propuesta actual con "Aceptar punto" y "Sugerir otro", el punto confirmado con "Cómo llegar" y las propuestas anteriores. Se actualiza al volver a la pantalla o con "Actualizar".
- `services/claimService.js`: `getMeetingPoint`, `proposeMeetingPoint` y `acceptMeetingPoint`.
- `MeetingPointCard`, `MeetingPointForm` y `ComoLlegarButton` se reutilizan; `meetingPointFlow.js` conserva la validación del formulario.

## Probar desde Android

1. Aplicar la migración (coordinarlo con el grupo): `npm run db:migrate` en `backend/`. Después `npm run dev`, y `npx expo start --go --clear` en `mobile/`.
2. Con una cuenta A, publicar un hallazgo. Con una cuenta B, abrirlo desde el buscador y reclamar "Es mío". Con A, aceptar el reclamo en "Mis reclamos".
3. A (tiene el objeto) ve "Proponé dónde y cuándo devolver el objeto"; B ve "Esperando que A proponga…". Probar enviar vacío: muestra los errores.
4. A propone. B, en el detalle del reclamo, ve "Propuesta recibida" con "Aceptar punto" y "Sugerir otro". Sugerir otro.
5. A ve la alternativa y la acepta. Las dos cuentas ven "Punto de encuentro confirmado" y el historial.
6. "Cómo llegar" abre Google Maps en navegación. En el emulador puede no encontrar ruta porque su ubicación por defecto está en California; en un celular en Buenos Aires inicia la navegación.

La devolución concretada y las valoraciones son del punto 10 ([historial-valoraciones.md](historial-valoraciones.md)). Quien recupera la confirma desde el detalle del reclamo, y a partir de ahí la app oculta esta sección.
