# Punto 8: devolución y punto de encuentro

Rama `feature/punto-encuentro`. Parte móvil completa del acuerdo del punto de encuentro y del botón "Cómo llegar". Como todavía no existen los reclamos (punto 7), la pantalla de prueba usa un reclamo de ejemplo ya aceptado y guarda el acuerdo en memoria. La parte de backend se propone abajo para coordinarla con el punto 7, porque depende de su tabla de reclamos y de la base compartida.

## Requisitos y cómo se cubren

| Requisito | Implementación |
| --- | --- |
| Una vez aceptado el reclamo, quien tiene el objeto propone el punto de encuentro | `proponer()` en `meetingPointFlow.js` solo lo permite al rol `tiene_objeto` y si todavía no hay propuesta. |
| La otra parte puede aceptarlo o sugerir uno alternativo | `aceptar()` y `sugerirAlternativa()` solo los puede usar quien no hizo la última propuesta. Ante una alternativa, la otra persona vuelve a decidir, hasta que alguien acepta. |
| Botón "Cómo llegar" que abre Google Maps (o la app de mapas por defecto) con la dirección precargada en modo navegación | `abrirComoLlegar()` en `directions.js`. Android: `google.navigation:q=` (Google Maps en navegación) → `geo:` (app por defecto) → Google Maps web. iOS: Google Maps → Apple Maps → web. |

## Archivos

- `mobile/services/meetingPoint/meetingPointFlow.js`: reglas del acuerdo, sin dependencias de React Native.
- `mobile/services/meetingPoint/directions.js`: URLs y apertura de "Cómo llegar".
- `mobile/components/meetingPoint/ComoLlegarButton.js`, `MeetingPointCard.js` y `MeetingPointForm.js`.
- `mobile/screens/MeetingPointDemoScreen.js`: pantalla de prueba (Inicio → "Punto de encuentro (prueba)"). Se puede quitar cuando exista el flujo real de reclamos.

`ComoLlegarButton` se puede usar en cualquier pantalla: `<ComoLlegarButton punto={{ direccion: 'Plaza Serrano, Palermo' }} />`.

## Probar desde Android

1. `npm run dev` en `backend/`, `npx expo start --go --clear` en `mobile/` y presionar `a`.
2. Iniciar sesión → "Punto de encuentro (prueba)".
3. Con "Tengo el objeto": elegir una sugerencia (o escribir una dirección y horario) → "Proponer punto de encuentro". Probar también enviar vacío: debe mostrar los errores.
4. Cambiar a "Soy el dueño": aparece la propuesta con "Aceptar punto" y "Sugerir otro". Sugerir otro punto.
5. Volver a "Tengo el objeto": aparece la alternativa; aceptarla. Queda "Punto de encuentro confirmado" y la propuesta anterior en el historial.
6. Tocar "Cómo llegar": abre Google Maps en navegación con la dirección. En el emulador puede decir que no encuentra ruta porque su ubicación por defecto está en California; en un celular en Buenos Aires inicia la navegación.

## Backend propuesto (coordinar con el punto 7)

Cuando exista la tabla de reclamos, una migración nueva:

```sql
CREATE TABLE public.meeting_point_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL REFERENCES public.users(id),
  address text NOT NULL CHECK (char_length(address) BETWEEN 5 AND 200),
  schedule text NOT NULL CHECK (char_length(schedule) BETWEEN 1 AND 100),
  reference text,
  latitude double precision,
  longitude double precision,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meeting_point_proposals_claim_idx ON public.meeting_point_proposals (claim_id, created_at);
```

Endpoints (requieren sesión; solo las dos partes de un reclamo con estado aceptado):

- `GET /claims/:id/meeting-point` → `{ estado, rol, propuestas: [...] }`.
- `POST /claims/:id/meeting-point/proposals` con `{ direccion, horario, referencia?, latitud?, longitud? }`. Valida las mismas reglas que `meetingPointFlow.js`: la primera propuesta solo la hace quien tiene el objeto y nadie propone dos veces seguidas. Devuelve 409 si no corresponde.
- `POST /claims/:id/meeting-point/accept` → marca `accepted_at` en la última propuesta, si la hizo la otra parte. 409 si ya estaba aceptado o es la propia propuesta.

Quién "tiene el objeto" sale del reclamo: en una publicación de tipo encontrado es quien publicó; en una de tipo perdido es quien indicó "Lo encontré". Con esos endpoints, la pantalla real reemplaza `acuerdoDemo` por las llamadas a la API y el selector de rol por el rol que devuelve el GET.
