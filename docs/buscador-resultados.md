# Punto 3: buscador inicial y resultados

Rama `feature/buscador-resultados`. Implementación backend (Express + PostgreSQL) y móvil
(React Native + Expo, React Navigation), siguiendo las convenciones del resto del proyecto.
Agrega la dependencia `expo-location` (correr `npm ci` en `mobile/`; si usás una
development build en vez de Expo Go, hay que recompilarla). Agrega las migraciones 006
(publicaciones y fotos) y, más adelante en `feature/detalle-publicacion`, la 007 (seguir
publicaciones).

Como todavía no existe el punto 5 (Publicar), no hay forma de cargar publicaciones reales
desde la app. Para poder probar el buscador y el detalle se agregó
`backend/scripts/seed-publications.js` (`npm run db:seed`), que inserta 24 publicaciones de
prueba directamente por SQL, sin pasar por un endpoint `POST /publications` (ese endpoint lo
define el punto 5).

## Probar desde Android

1. Aplicar migraciones y sembrar datos de prueba desde `backend/`:
   ```powershell
   npm run db:migrate
   npm run db:seed -- --owner=tu@email.com
   ```
   `--owner` asigna 2 publicaciones de prueba a tu cuenta real, para poder ver la vista de
   dueño (botón "Gestionar publicación" y dirección exacta) en el punto 4. Sin esa opción,
   quedan a nombre de un usuario de prueba ("Diego (prueba)").
2. Reiniciar el backend: `npm run dev`. Reiniciar Metro desde `mobile/`:
   `npx expo start --go --localhost --clear`. Con el emulador encendido, presionar `a`.
3. Iniciar sesión: la app abre directo en "Buscar" (antes abría en el menú; ahora "Menú"
   quedó arriba a la derecha y en una pantalla propia).
4. Probar: Perdí algo → Llaves → barrio Palermo → Hoy → Buscar. Deberían aparecer solo
   publicaciones **encontradas** (tipo opuesto), con fotos, barrio, fecha y coordenadas
   aproximadas.
5. Ubicación actual: en el emulador, Extended controls → Location, cargar
   `-34.5780, -58.4265` (Palermo) o correr `adb emu geo fix -58.4265 -34.5780` (ojo: la
   longitud va primero). Tocar "Usar mi ubicación actual" en el buscador: debería sugerir
   "Palermo". Con la ubicación por defecto del emulador (California) debería avisar que
   está fuera de la zona cubierta.
6. Probar un rango de fechas inválido (por ejemplo con la fecha "hasta" anterior a "desde",
   o una fecha futura): debe mostrar el error sin buscar.
7. En los resultados: la lista pagina de a 10 (probar con un filtro amplio, por ejemplo
   "Encontré algo" + "Cualquier barrio" + "Última semana", para tener más de 10
   resultados y que cargue la página siguiente al llegar al final).
8. Desde los resultados, "Refinar filtros" permite cambiar los criterios sin volver al
   buscador inicial, y hay chips para ordenar por "Más recientes" o "Más cercanos" (este
   último deshabilitado si no hay barrio ni ubicación elegidos).
9. Una búsqueda sin resultados (por ejemplo una categoría/barrio poco usado en el seed)
   ofrece "Publicar mi pérdida/hallazgo" (navega a un placeholder del punto 5) y "Guardar
   búsqueda como alerta" (queda guardada en el dispositivo, ver sección siguiente).
10. Las últimas búsquedas y las alertas guardadas se muestran en la pantalla inicial y se
    repiten con un toque.
11. Sin conexión (`adb shell svc wifi disable` y `adb shell svc data disable`, o avión en
    el emulador): la búsqueda muestra los últimos resultados guardados en el dispositivo
    con el aviso correspondiente; si la búsqueda nunca se hizo con conexión, avisa que no
    hay nada guardado.

## Endpoints

- `GET /publications`: búsqueda paginada. Autenticación opcional (`Authorization: Bearer`
  si hay sesión; funciona igual sin ella). Parámetros de consulta:

  | parámetro | valores | obligatorio |
  |---|---|---|
  | `situation` | `lost` \| `found` (lo que le pasó a quien busca) | sí |
  | `category` | `documents`, `keys`, `electronics`, `pets`, `clothing`, `other` | no |
  | `q` | palabras clave, hasta 100 caracteres | no |
  | `neighborhood` | barrio o localidad | no |
  | `from`, `to` | `AAAA-MM-DD` | no |
  | `sort` | `recent` (por defecto) \| `nearest` | no |
  | `lat`, `lng` | obligatorios si `sort=nearest` | no |
  | `page`, `page_size` | por defecto 1 y 10 (máximo 30) | no |

  La búsqueda siempre devuelve el tipo **opuesto** a `situation`, y solo publicaciones con
  estado `open` o `in_claim` (las resueltas se ven únicamente en el detalle, punto 4).

  Ejemplo:
  ```powershell
  Invoke-RestMethod "http://localhost:3000/publications?situation=lost&category=keys&page_size=5"
  ```
  ```json
  {
    "results": [{
      "id": "…", "type": "found", "title": "Llavero con 3 llaves y destapador",
      "category": "keys", "neighborhood": "Palermo", "occurred_on": "2026-10-31",
      "time_slot": "afternoon", "status": "open",
      "approx_latitude": -34.58, "approx_longitude": -58.43, "distance_km": null,
      "created_at": "…", "photos": [{ "id": "…", "url": "/publications/<id>/photos/<id>" }]
    }],
    "page": 1, "page_size": 5, "total": 12, "has_more": true
  }
  ```
  Nunca incluye `latitude`, `longitude`, `exact_address` ni `publisher_id`: esas columnas
  son privadas (ver el punto 4 para la dirección exacta).

- `GET /publications/:id/photos/:photoId`: pública, sirve la foto (`image/jpeg` o
  `image/png`) o 404. `Cache-Control: public, max-age=86400`.

## Integración con las partes del grupo

- **Punto 5 (Publicar)**: la migración `006_publications.sql` define las columnas y
  constraints que necesita el alta real (`type`, `category`, `title`, `description`,
  `neighborhood`, `occurred_on`, `time_slot`, `status`, `exact_address`, `latitude`,
  `longitude`). Las columnas `approx_latitude`/`approx_longitude` son `GENERATED` (se
  calculan solas a partir de `latitude`/`longitude`): no hay que cargarlas. Las fotos van
  en `publication_photos` con `position` 0 a 4. Falta agregar `POST /publications` (a
  propósito, no se implementó acá para no definir ese contrato por otra rama) y una
  columna `expires_at` para el vencimiento a los 30 días. La ruta de navegación `Publish`
  ya existe (con `PendingFeatureScreen` como placeholder) y recibe
  `{ tipo, categoria, barrio }` desde "sin resultados".
- **Punto 9 (Alertas y publicaciones seguidas)**: "Guardar búsqueda como alerta" quedó
  implementado 100% del lado del cliente (`mobile/services/search/recentSearches.js`,
  clave `hallado.busquedas.<userId>` en AsyncStorage, con un flag `guardada:true` por
  criterio). No hay tabla ni endpoint backend: el punto 9 puede leer
  `listarBusquedas(userId)` para migrar estas alertas a un backend real cuando lo
  implemente. La semántica de `situation` (tipo opuesto) vive en
  `backend/src/publication-search.js` y se puede reutilizar para el matching de alertas.
- **Punto 6 (Modo sin conexión)**: ya integrado. El buscador llama a
  `guardarResultadosBusqueda` después de cada búsqueda exitosa con conexión, y
  `obtenerResultadosGuardados` cuando no hay conexión o falla la petición.

## Verificación

Desde `backend/`: `npm test` (mockea la base, no necesita PostgreSQL) y, con una base de
desarrollo disponible y las migraciones aplicadas, `npm run test:publications` (22
comprobaciones HTTP/PostgreSQL con datos temporales dentro de una transacción que se
revierte). Desde `mobile/`: `node --test "scripts/*.test.mjs"` prueba los criterios de
búsqueda y los barrios sin depender de React Native.

Todo lo anterior se verificó contra un PostgreSQL local descartable (contenedor Docker, no
la base compartida del equipo): migración, seed, `test:publications` (22 verificaciones) y
la app corriendo en un emulador Android real (registro, login, búsqueda guiada, tipo
opuesto, filtro de barrio, fecha y últimas búsquedas persistidas).

**Nota del seed:** las fotos de prueba reutilizan un PNG de 1×1 válido (para no depender de
generar bytes de imagen reales). El backend la sirve correctamente (200, `image/png`), pero
el componente `Image` de React Native no siempre la renderiza y cae al placeholder
"Sin foto" — es una limitación del PNG mínimo, no del buscador. Con fotos reales (una vez
que el punto 5 las cargue) no debería reproducirse.
