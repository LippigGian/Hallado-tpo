# Punto 5: publicar un hallazgo o una pérdida

Rama `feature/publicar-hallazgo-perdida`. Backend (Express + PostgreSQL) y app (React Native + Expo) siguiendo las clases: React Navigation, Axios, useContext, hooks propios, AsyncStorage para el borrador, expo-image-picker (cámara y galería) y expo-location (ubicación actual).

## Requisitos y cómo se cubren

| Requisito del enunciado | Implementación |
| --- | --- |
| Carga guiada en pasos | `PublishPublicationScreen`: 4 pasos para una pérdida y 5 para un hallazgo, con barra de avance y validación en cada paso. |
| Elegir el tipo (perdí / encontré) | `TypeStep` |
| Tomar fotos con la cámara o elegirlas de la galería | `PhotosStep`: de 1 a 5 fotos, la primera es la portada. |
| Título, descripción, categoría, fecha y hora del suceso | `DetailsStep` (fecha `DD/MM/AAAA` y hora `HH:MM`, con la fecha y hora actuales de entrada) |
| Barrio y dirección exacta, escrita o con la ubicación actual (coordenadas) | `LocationStep`: la dirección se escribe siempre; el botón de ubicación actual carga latitud y longitud. |
| Pregunta de verificación con respuesta privada (solo hallazgos) | `VerificationStep`. La API nunca devuelve la respuesta a otra persona. |
| Borrador si se interrumpe la carga | `usePublicationDraft` guarda cada cambio en AsyncStorage (por usuario) y al volver retoma en el mismo paso. Se borra al publicar. |
| "Mis publicaciones" con estado | `MyPublicationsScreen`: abierta, en reclamo, resuelta o vencida. |
| Vencen a los 30 días y pueden renovarse | `expires_at` en la base. "Vencida" se calcula al leer (no hace falta un proceso aparte). Botón "Renovar por 30 días". |

## Endpoints

Todos exigen sesión (`Authorization: Bearer <token>`), salvo las fotos.

| Método y ruta | Qué hace |
| --- | --- |
| `POST /publications` | Crea una publicación. 201 con la publicación. Máximo 20 por hora desde una misma conexión. |
| `GET /publications/mine` | Publicaciones propias (hasta 100), la más nueva primero. |
| `GET /publications/:id` | Detalle. Quien no es dueño no recibe la dirección exacta ni la respuesta de verificación. |
| `POST /publications/:id/renew` | Renueva 30 días. Solo el dueño (404 si no) y solo si está abierta o vencida (409 si está en reclamo o resuelta). |
| `GET /publications/:id/photos/:photoId` | Imagen. Pública, como la foto de perfil, para poder usarla en `<Image>`. |

Cuerpo de `POST /publications` (los campos fuera de esta lista se rechazan):

```json
{
  "type": "found",
  "title": "Llaves con llavero azul",
  "description": "Encontré un llavero con tres llaves en la plaza.",
  "category": "keys",
  "occurred_at": "2026-10-31T21:30:00.000Z",
  "neighborhood": "Caballito",
  "address": "Av. Rivadavia 5000",
  "latitude": -34.618765,
  "longitude": -58.436789,
  "verification_question": "¿De qué color es el llavero?",
  "verification_answer": "Azul",
  "photos": ["<base64 de un JPEG o PNG>", "..."]
}
```

- `type`: `lost` o `found`. `category`: `documents`, `keys`, `electronics`, `pets`, `clothing`, `other`.
- `latitude` y `longitude` son opcionales, pero van juntas.
- `verification_question` y `verification_answer` son obligatorias en `found` y no se aceptan en `lost`.
- `photos`: de 1 a 5, JPEG o PNG de hasta 2 MB cada una, en base64 sin prefijo `data:`. El formato se detecta por el contenido.
- `occurred_at` no puede ser futura ni de hace más de un año.

Errores: 400 con `{ "error": "mensaje" }` (el mismo formato que el resto de la API), 401 sin sesión válida, 404, 409, 503 si falla la base.

## Qué ve cada persona

| Dato | Quien publica | Otra persona |
| --- | --- | --- |
| Título, descripción, categoría, barrio, fecha, fotos, estado | Sí | Sí |
| `verification_question` | Sí | Sí (hace falta para reclamar) |
| `verification_answer` | Sí | **Nunca** |
| `address` | Sí | **No** (`null`) hasta que el reclamo sea aceptado |
| `latitude` / `longitude` | Exactas | Aproximadas (3 decimales, unos 100 m) |

Esta regla vive en un solo lugar: `backend/src/publication-view.js` (`serializePublication`). El enunciado pide mostrar coordenadas en los resultados pero ocultar la dirección exacta hasta aceptar el reclamo; para cumplir ambas se publican coordenadas aproximadas. Si el grupo prefiere ocultarlas del todo o mostrarlas exactas, se cambia en esa función.

## Archivos

Backend (`backend/`):

- `migrations/006_publications.sql`: tablas `publications` y `publication_photos`.
- `src/publication-routes.js`: HTTP. `src/publication-service.js`: consultas. `src/publication-validation.js`: validación. `src/publication-view.js`: qué ve cada persona.
- `src/require-session.js`: middleware reutilizable de sesión. `src/image-validation.js` y `src/uuid.js`: utilidades compartidas.

App (`mobile/`):

- `screens/PublishPublicationScreen.js` y `screens/MyPublicationsScreen.js`.
- `components/publication/*`: un componente por paso y `PublicationCard`. `components/FormField.js`, `PrimaryButton.js`, `ChoiceChips.js`: componentes de interfaz reutilizables.
- `hooks/usePublicationDraft.js`, `services/publicationService.js`, `services/publicationDraft.js`.
- `config/publicationOptions.js` (categorías, estados y límites compartidos), `config/theme.js`, `utils/publicationValidation.js`, `utils/dateTime.js`, `utils/photos.js`.

## Cambios en archivos compartidos

- `mobile/services/api.js`: el token ahora se envía en **todas** las rutas salvo login, registro y recuperación (antes solo en `/auth/me` y `/profiles/me`). Se agregan `requiresSession(url)` y `apiUrl(path)`.
- `mobile/context/AuthContext.js`: un 401 en cualquier ruta con sesión cierra la sesión (antes solo en esas dos).
- `mobile/app.json`: el plugin de `expo-image-picker` ahora permite la cámara (el de perfiles la bloqueaba) y se agrega el plugin de `expo-location`. **Quien use development build debe recompilar** (`npx expo prebuild --clean` y `npx expo run:android`); en Expo Go no hace falta.
- `mobile/package.json`: se agregan `@react-native-async-storage/async-storage` (2.2.0, la misma versión que usa la rama de modo sin conexión) y `expo-location`, y el script `npm test`. Después de bajar la rama: `npm ci` en `mobile/`.
- `backend/src/app.js`: monta `/publications`.

## Integración con las demás partes

- **Buscador, resultados y alertas (puntos 3 y 9)**: leen `public.publications` (índice `publications_search_idx` sobre estado, tipo y fecha). Para mostrar cada resultado se puede reutilizar `serializePublication` y `PublicationCard`. Las categorías están en `config/publicationOptions.js`.
- **Detalle (punto 4)**: `GET /publications/:id` ya existe y devuelve `is_owner`. Falta la pantalla; desde "Mis publicaciones" se le puede pasar `onPress` a `PublicationCard`.
- **Reclamos (punto 7)**: usar `status = 'claimed'` / `'resolved'` (ya permitidos por la restricción) y `serializePublication(row, viewerId, { exactLocation: true })` para mostrar la dirección a quien tenga un reclamo aceptado. `createRequireSession` sirve para las rutas nuevas.
- **Modo sin conexión (punto 6)**: ya está en `main`. Todavía **no está conectado** con esta pantalla: si publicar falla por falta de red, el borrador queda guardado y se puede reintentar, pero no se encola como "pendiente de envío". Para conectarlo falta (1) registrar el enviador al iniciar la app, con la ruta `/publications` y no `/publicaciones` como dice `docs/modo-offline.md`, y (2) llamar a `encolarPublicacion` cuando `useConnectivity().isOnline` sea `false`:

  ```js
  import { registrarEnviadorPublicaciones } from '../services/offline/pendingPublications';
  import { createPublication } from '../services/publicationService';
  // `datos` es lo que devuelve buildPayload(form); encolarPublicacion espera las fotos en `fotos`.
  registrarEnviadorPublicaciones(({ fotos, ...campos }) => createPublication({ ...campos, photos: fotos }));
  ```

## Cómo probar

### 1. Backend (sin la base compartida)

```powershell
cd backend
npm ci
npm test
```

`npm test` incluye las pruebas de validación y de privacidad de `publication.test.js` (no necesitan base de datos).

### 2. Backend contra PostgreSQL

Primero hay que aplicar la migración 006 en la base. **La base de Neon es compartida: coordinar con el grupo antes de ejecutar `npm run db:migrate`.** Después:

```powershell
npm run test:publications
```

Ejecuta 63 comprobaciones HTTP/PostgreSQL con usuarios temporales dentro de una transacción que se revierte: no deja publicaciones en la base.

### 3. App en el emulador

1. Backend: `npm run dev` en `backend/`. App: `npx expo start --go --clear` en `mobile/` y presionar `a`.
2. Iniciar sesión → **Publicar pérdida o hallazgo**.
3. Pérdida: elegir "Perdí algo", agregar fotos, completar los datos, indicar barrio y dirección → **Publicar**. Debe abrir "Mis publicaciones" con la tarjeta en estado Abierta.
4. Hallazgo: repetir con "Encontré algo". Aparece un paso más con la pregunta y la respuesta.
5. Borrador: dejar la carga a mitad (por ejemplo en el paso 3), cerrar la app por completo y abrirla de nuevo → **Publicar pérdida o hallazgo** retoma en el mismo paso con los datos. "Empezar de nuevo" lo descarta.
6. Validaciones: avanzar con campos vacíos, fecha futura o `31/02/2026` debe mostrar el error sin avanzar.
7. Sin conexión: apagar el backend y publicar. Debe mostrar "No pudimos conectar con la API" y conservar el borrador.
8. Vencimiento: en la base, `UPDATE public.publications SET expires_at = now() - interval '1 day' WHERE id = '...'`. Al refrescar, la tarjeta pasa a Vencida y aparece **Renovar por 30 días**.

Cámara y ubicación en el emulador: en Android Studio, Extended controls (los tres puntos) → Location para fijar coordenadas y Camera para elegir la escena virtual. Para la galería, arrastrar una imagen al emulador.

### 4. Probar la API sin la app (curl o Postman)

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login -ContentType 'application/json' -Body '{"email":"tu@mail.com","password":"tu-clave"}'
$headers = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod -Uri http://localhost:3000/publications/mine -Headers $headers
```

En Postman: pestaña Authorization → Bearer Token, y `POST /publications` con el cuerpo JSON de arriba.

## Decisiones a confirmar con el grupo

- Al menos una foto es obligatoria (el enunciado no lo aclara).
- Fecha y hora se escriben a mano porque ningún apunte incluye un selector de fecha. Se puede agregar `@react-native-community/datetimepicker` si el docente lo acepta.
- Coordenadas aproximadas para quien no es dueño (ver arriba).
- Las fotos se guardan en PostgreSQL, igual que la foto de perfil. Para un uso real conviene almacenamiento de objetos.

## Limitaciones conocidas

- Verificado: pruebas unitarias, prueba integral contra PostgreSQL y bundle de Android con Metro. **No se probó en un emulador ni en un teléfono**: cámara, galería y ubicación son lo primero a revisar en la prueba manual.
- Las fotos se envían con el base64 que entrega expo-image-picker al elegirlas (como en Editar perfil). El borrador guarda solo las URIs, no las imágenes: al retomar un borrador, la app intenta leer cada archivo y, si no puede, pide quitar y volver a agregar esa foto antes de publicar.
