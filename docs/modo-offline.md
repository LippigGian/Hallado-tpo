# Punto 6: modo sin conexión

Capa offline de la app y su integración con las pantallas reales: buscador (punto 3), detalle (punto 4), publicar y "Mis publicaciones" (punto 5), y las acciones de reclamos y punto de encuentro (puntos 7 y 8).

Dependencias agregadas (versiones de Expo SDK 58): `@react-native-community/netinfo`, `@react-native-async-storage/async-storage` y `expo-file-system`. Después de bajar la rama, ejecutar `npm ci` en `mobile/`.

## Requisitos y cómo se cubren

| Requisito | Implementación |
| --- | --- |
| Conservar las últimas publicaciones consultadas (detalle, fotos y barrio) | `guardarPublicacionVista` guarda el detalle en AsyncStorage y descarga las fotos al almacenamiento de la app. Conserva las 20 más recientes. |
| Búsqueda sin conexión con aviso de información desactualizada | `guardarResultadosBusqueda` guarda cada búsqueda exitosa con su fecha. `obtenerResultadosGuardados` devuelve la misma búsqueda o, si nunca se hizo, la última (con `coincideConBusqueda: false`). |
| Crear publicación sin conexión, "pendiente de envío", y publicarla al reconectar | `encolarPublicacion` la guarda con estado `pendiente_envio` y copia las fotos a una carpeta propia. `ConnectivityProvider` envía la cola al recuperar la conexión y al iniciar sesión con internet. |
| Acciones que requieren conexión deshabilitadas con mensaje claro | `ConnectionRequiredButton` se deshabilita sin conexión y muestra "Necesitás conexión a internet para continuar." |
| Abrir la app sin conexión | Si al iniciar no hay red, `AuthContext` conserva la sesión guardada en lugar de pedir login. La sesión igual vence a la hora. |

Además, `OfflineBanner` muestra en toda la app un aviso "Sin conexión" y la cantidad de publicaciones pendientes de envío.

## Archivos

- `mobile/context/ConnectivityContext.js`: `ConnectivityProvider` y `useConnectivity()` → `{ isOnline, pendientes, cantidadPendientes, ultimoEnvio, sincronizarPendientes }`.
- `mobile/services/offline/offlineCache.js`: cache de publicaciones vistas y de búsquedas.
- `mobile/services/offline/pendingPublications.js`: cola de publicaciones pendientes de envío.
- `mobile/components/offline/OfflineBanner.js` y `ConnectionRequiredButton.js`.

## Dónde se usa

| Pantalla | Comportamiento sin conexión |
| --- | --- |
| Resultados de búsqueda (`SearchResultsScreen`) | Muestra los últimos resultados guardados con el aviso "la información podría no estar actualizada". |
| Detalle (`PublicationDetailScreen`) | Muestra la versión guardada con sus fotos y la fecha en que se guardó. "Es mío", "Lo encontré" y "Seguir" quedan deshabilitados. |
| Publicar (`PublishPublicationScreen`) | El botón pasa a "Guardar para publicar después": la publicación queda `pendiente_envio` (con copia de las fotos) y se publica sola al reconectar con `createPublication`, el mismo alta del punto 5. |
| Mis publicaciones (`MyPublicationsScreen`) | Lista "Pendientes de envío". Si el servidor rechaza una, muestra el motivo con "Reintentar" y "Descartar". Al enviarse, la lista se recarga. |
| Reclamos y punto de encuentro | Aceptar, rechazar, proponer y aceptar un punto usan `ConnectionRequiredButton`. |

`ConnectivityProvider` registra `createPublication` como enviador de la cola. Si el servidor rechaza una publicación pendiente (4xx), queda `error_envio` con el mensaje; si el error es de red, se reintenta en la próxima reconexión. Un timeout no se encola, porque el servidor pudo haberla guardado.

Para lógica propia en otras pantallas: `const { isOnline } = useConnectivity()`.

## Probar desde Android

1. Backend: `npm run dev` en `backend/`. App: `npx expo start --go --clear` en `mobile/` y presionar `a`.
2. Iniciar sesión. Con conexión, buscar y abrir dos o tres publicaciones (se guardan detalle, fotos y resultados).
3. Cortar la red del emulador (en una terminal de la PC):
   ```
   adb shell svc wifi disable
   adb shell svc data disable
   ```
   Aparece "Sin conexión" arriba de la pantalla.
4. Sin conexión: las publicaciones abiertas se siguen viendo con su foto y la fecha de guardado; los resultados muestran el aviso de información desactualizada; "Es mío", "Lo encontré" y "Seguir" quedan deshabilitados con el mensaje.
5. Publicar sin conexión: Menú → "Publicar pérdida o hallazgo", completar los pasos y tocar "Guardar para publicar después". En "Mis publicaciones" aparece en "Pendientes de envío".
6. Volver a conectar:
   ```
   adb shell svc wifi enable
   adb shell svc data enable
   ```
   La publicación se envía sola ("se publicaron 1 pendiente(s)") y aparece en la lista de "Mis publicaciones".
7. Abrir la app ya estando sin red no se puede probar con Expo Go: Expo Go descarga el código desde Metro (la PC) por la red, así que sin conexión no arranca. En una app compilada (development build o APK), `AuthContext` conserva la sesión guardada y se ven las publicaciones guardadas.

`adb` está en `~/Library/Android/sdk/platform-tools/` (Mac) o `%LOCALAPPDATA%\Android\Sdk\platform-tools\` (Windows) si no está en el PATH.

## Nota para emulador con Expo Go

Si la app muestra "No pudimos conectar con la API" aunque el backend responde en `http://10.0.2.2:3000/health` desde el navegador del emulador, usar en `mobile/.env` la IP local de la PC (la misma que muestra Metro, por ejemplo `EXPO_PUBLIC_API_URL=http://192.168.0.4:3000`) y reiniciar Expo con `--clear`. El backend ya escucha en todas las interfaces.
