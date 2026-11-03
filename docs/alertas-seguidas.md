# Punto 9: alertas y publicaciones seguidas

Cualquier búsqueda se puede guardar como alerta. En "Mis alertas" se ve cuántas publicaciones nuevas coinciden con cada una, y en "Seguidas" las publicaciones que la persona sigue, con un aviso cuando cambian de estado. Rama `feature/alertas-seguidas`. Agrega la migración `009_alerts.sql`.

> **Con esta rama, el detalle de una publicación y "Seguir" necesitan la 009 aplicada**, porque leen y escriben `publication_follows.last_seen_status`. Sin ella, el detalle responde 503.

## Requisitos y cómo se cubren

| Requisito | Implementación |
| --- | --- |
| Cualquier búsqueda del buscador puede guardarse como alerta, con todos sus criterios (tipo, categoría, barrio y palabras clave) | Botón "Guardar búsqueda como alerta" en los resultados, siempre visible (antes solo aparecía sin resultados). `criteriosAAlerta` convierte la búsqueda en `POST /alerts`. También se guarda la fecha del suceso (ver "Fechas"). |
| Sección "Mis alertas": ver, pausar o eliminar, con la cantidad de publicaciones nuevas de cada una | `MyAlertsScreen` + `GET /alerts` (`new_count`), `PATCH /alerts/:id` y `DELETE /alerts/:id`. Tocar una alerta abre sus coincidencias (`AlertResultsScreen`). |
| Sección "Seguidas" con las publicaciones que la persona sigue | `FollowedPublicationsScreen` + `GET /follows`. Seguir y dejar de seguir siguen en el detalle (punto 4). |
| Indicador visual de novedad cuando aparece una publicación que coincide con una alerta o cuando una seguida cambia de estado | Contadores en los botones "Mis alertas" y "Seguidas" del Menú (`GET /me/novelties`), "N publicaciones nuevas" en cada alerta, "Nueva" en cada coincidencia y "Cambió de estado: Abierta → En reclamo" en cada seguida. Solo dentro de la app, sin notificaciones push. |

## Reglas

- **Coincidencias:** exactamente las mismas que mostraría el buscador. `searchConditions` (`publication-search.js`) lo comparten el buscador y las alertas: tipo opuesto a lo que le pasó a quien busca, solo publicaciones visibles (abiertas sin vencer o en reclamo), categoría, barrio, palabras clave sin tildes y rango de fechas. Nunca cuentan las publicaciones propias.
- **Publicación nueva:** una coincidencia creada después de la última vez que la persona abrió esa alerta (`last_seen_at`). Al abrir las coincidencias, el contador vuelve a 0. Una alerta recién creada arranca en 0.
- **Fechas:** la persona elige "Hoy", "Últimos 3 días", "Última semana" o "Elegir fechas" como en el buscador, pero la alerta guarda siempre un **rango concreto** (`date_from`/`date_to`), calculado al guardar. Así no se corre con los días: una alerta de "Hoy" guardada el 02/11 sigue buscando cosas que pasaron el 02/11, aunque se publiquen después. `date_preset` solo sirve para mostrarla: "Últimos 3 días (31/10 – 02/11)". Sin margen extra de días.
- **Pausar:** una alerta pausada muestra 0 publicaciones nuevas. Al reanudarla se toma como vista en ese momento: lo publicado durante la pausa no se acumula.
- **Tope y duplicados:** hasta 10 alertas por persona. La misma búsqueda no se puede guardar dos veces; se comparan sin distinguir mayúsculas ni espacios.
- **Seguidas:** hay novedad cuando el estado actual (`open`, `claimed`, `expired` o `resolved`, como lo muestra la API) es distinto del último que vio la persona (`last_seen_status`). Al seguir una publicación se guarda su estado actual, así que arranca sin novedad. Abrir el detalle la marca como vista.

## Backend

- Migración `009_alerts.sql`:
  - Tabla `search_alerts`: persona, `situation` (`lost`/`found`, igual que el buscador), `category`, `neighborhood`, `keywords`, `date_preset`, `date_from`, `date_to`, `paused`, `last_seen_at` y `created_at`. Tiene restricciones de rango y un índice único por criterios.
  - Columna `last_seen_status` en `publication_follows`. Las seguidas que ya existían se completan con su estado actual al migrar, para que no aparezcan todas con novedad.
- `src/alert-validation.js`: valida y normaliza la alerta. La fecha llega como rango concreto, no puede ser futura (según la hora de Argentina) y exige la opción elegida.
- `src/alert-service.js`: consultas de alertas, coincidencias, seguidas y novedades. El alta bloquea a la persona (`FOR UPDATE`) para respetar el tope y usa `ON CONFLICT DO NOTHING` para los duplicados.
- `src/alert-routes.js` (sesión obligatoria en todas):
  - `GET /alerts` → `{ alerts: [...], max_alerts }`. Cada alerta incluye `new_count`, y las fechas van como `AAAA-MM-DD`.
  - `POST /alerts` con `{ situation, category?, neighborhood?, keywords?, date_preset?, date_from?, date_to? }` → 201 con `{ alert }`. Responde 400 si los datos son inválidos y 409 con `code: 'duplicate'` o `code: 'limit'`.
  - `PATCH /alerts/:id` con `{ paused: true|false }` → `{ alert }`. `DELETE /alerts/:id` → `{ deleted: true }`. Las dos responden 404 si la alerta no es de la persona.
  - `GET /alerts/:id/publications?page=` → `{ alert, results, page, page_size, total, has_more }`. Ordena las más recientes primero e incluye `is_new` en cada resultado. No marca la alerta como vista.
  - `POST /alerts/:id/seen` → deja la alerta sin novedades.
  - `GET /follows` → `{ publications: [...] }`, con `status`, `previous_status`, `has_update` y `followed_at`. Las que tienen novedad van primero.
  - `GET /me/novelties` → `{ alerts: { new_publications, with_news }, follows: { updated } }`.
- `publication-detail.js`: abrir el detalle de una seguida marca su estado como visto, y "Seguir" guarda el estado actual.
- Pruebas: `npm test` (`test/alerts.test.js`, más los casos nuevos de `test/publication-detail.test.js`) y, con la 009 aplicada, `npm run test:alerts` contra PostgreSQL. Todo corre dentro de una transacción que se deshace. Con `npm run test:alerts -- --with-migration` aplica la 009 solo dentro de esa transacción, para probarla antes de migrar la base compartida.

## App

- `services/alertService.js`: llamadas a la API.
- `services/search/searchCriteria.js` (funciones puras, testeadas en `scripts/alerts.test.mjs`): `criteriosAAlerta`, `describirAlerta`, `describirFechaAlerta`, `textoNovedadAlerta`, `textoCambioEstado` y `textoContador`.
- `screens/SearchResultsScreen.js`: "Guardar búsqueda como alerta" con `ConnectionRequiredButton`. Después de guardar muestra el enlace "Ver mis alertas".
- `screens/MyAlertsScreen.js`: lista con la descripción, la fecha y el contador. Permite pausar o reanudar, eliminar con confirmación y actualizar deslizando hacia abajo.
- `screens/AlertResultsScreen.js`: coincidencias paginadas con "Nueva". Marca la alerta como vista apenas muestra la primera página, para que "Mis alertas" ya muestre 0 al volver. Las páginas siguientes calculan "Nueva" con la última vista que tenía la alerta al abrirla.
- `screens/FollowedPublicationsScreen.js`: seguidas con su estado (`PublicationCard` con `mostrarEstado`) y la insignia de cambio (`novedad`). Se recarga al volver del detalle.
- `screens/HomeScreen.js`: botones "Mis alertas" y "Seguidas" con contador, que se actualiza cada vez que se vuelve al Menú. El Menú ahora tiene scroll.
- **Alertas que había en el dispositivo:** antes, las alertas se guardaban solo en AsyncStorage (`recentSearches.js`). `services/alerts/localAlertsMigration.js` las sube una vez al backend al abrir el buscador, el Menú o "Mis alertas", y las quita del dispositivo. La fecha se calcula con el día en que se guardó cada una. Ya no existe la sección "Alertas guardadas en este dispositivo".
- **Sin conexión (punto 6):** "Mis alertas" y "Seguidas" muestran la última lista cargada (`services/alerts/alertsCache.js`, por persona) con su fecha. Pausar, eliminar, guardar una alerta y ver coincidencias necesitan conexión.

## Probar desde Android

1. Aplicar la migración (coordinarlo con el grupo): `npm run db:migrate` en `backend/`. Después `npm run dev`, y `npx expo start --go --clear` en `mobile/`.
2. Con una cuenta A, buscar "Perdí algo" + Llaves + un barrio + "Hoy". En los resultados, tocar "Guardar búsqueda como alerta". Tocarlo de nuevo con la misma búsqueda no se puede: el botón queda en "Alerta guardada". Refinar los filtros habilita guardar otra.
3. Menú → "Mis alertas": aparece "Perdí · Llaves · Barrio" con "Hoy (dd/mm)" y "Sin publicaciones nuevas".
4. Con una cuenta B, publicar un hallazgo de llaves en ese barrio, con fecha de hoy.
5. Con A, volver al Menú: "Mis alertas" muestra el contador 1. En la lista aparece "1 publicación nueva". Al tocar la alerta, la publicación aparece con "Nueva". Al volver, el contador está en 0.
6. Pausar la alerta: muestra "Pausada" y no cuenta novedades. Reanudarla y eliminarla, con confirmación.
7. Con A, abrir la publicación de B y tocar "Seguir publicación". En Menú → "Seguidas" aparece con el estado "Abierta" y sin novedad.
8. Con otra cuenta C, reclamar esa publicación ("Es mío"): pasa a "En reclamo". Con A, el botón "Seguidas" del Menú muestra 1, y la tarjeta dice "Cambió de estado: Abierta → En reclamo". Al abrir el detalle y volver, la insignia desaparece.
9. Sin conexión (`adb shell svc wifi disable` y `adb shell svc data disable`): "Mis alertas" y "Seguidas" muestran la lista guardada con su fecha, y las acciones quedan deshabilitadas.

## Integración con las demás partes

- **Buscador (punto 3):** los criterios y la semántica de `situation` son los mismos. Si cambian los filtros del buscador, el cambio va en `searchConditions` y las alertas lo toman solas.
- **Detalle (punto 4):** `GET /publications/:id` marca la seguida como vista. `POST /publications/:id/follow` guarda el estado inicial.
- **Reclamos (punto 7) y devoluciones (punto 10):** las seguidas detectan cualquier cambio de `publications.status` (`claimed`, `resolved`) y el vencimiento (`expired`). No hace falta avisar desde esos puntos.
- **Modo sin conexión (punto 6):** se usa `useConnectivity().isOnline` y `ConnectionRequiredButton`.

## Verificación

- Desde `backend/`: `npm test`, 68 tests con mocks y sin PostgreSQL.
- Desde `mobile/`: `node --test "scripts/*.test.mjs"`, 48 tests. `npx expo lint` da los mismos 3 errores previos de `AuthFlow.js` que hay en `main`, y `npx expo export --platform android` compila.
- **Pendiente:** correr `npm run test:alerts` contra PostgreSQL y probar en el emulador con la 009 aplicada. Hasta ahora no hubo una base disponible para hacerlo.
