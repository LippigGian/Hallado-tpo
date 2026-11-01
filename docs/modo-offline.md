# Punto 6: modo sin conexión

Rama `feature/modo-offline`. Infraestructura en React Native para que la app funcione sin internet. Las pantallas de búsqueda, detalle y publicación (puntos 3, 4 y 5) todavía no existen: este punto deja lista la capa offline y una pantalla de prueba con datos de ejemplo. Cada equipo integra su pantalla llamando a las funciones de abajo.

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
- `mobile/screens/OfflineDemoScreen.js`: pantalla de prueba (Inicio → "Modo sin conexión (prueba)"). Se puede quitar cuando estén las pantallas reales.

## Integración con las partes del grupo

### Punto 3: buscador y resultados

```js
import { useConnectivity } from '../context/ConnectivityContext';
import { guardarResultadosBusqueda, obtenerResultadosGuardados } from '../services/offline/offlineCache';

const { isOnline } = useConnectivity();
if (isOnline) {
  const { data } = await api.get('/publicaciones', { params: criterios });
  await guardarResultadosBusqueda(criterios, data);
  // mostrar data
} else {
  const guardado = await obtenerResultadosGuardados(criterios);
  // guardado = { resultados, guardadoEn, coincideConBusqueda } o null.
  // Mostrar guardado.resultados con el aviso: "La información podría no estar actualizada".
}
```

Conviene usar la misma forma de `criterios` en todas las llamadas (por ejemplo `{ queOcurrio, categoria, barrio, cuando }`): la clave de la búsqueda se arma con esos campos.

### Punto 4: detalle de publicación

```js
import { guardarPublicacionVista, obtenerPublicacionGuardada } from '../services/offline/offlineCache';

// Con conexión, después de cargar el detalle:
await guardarPublicacionVista(publicacion); // necesita publicacion.id; fotos como URLs o { url }
// Sin conexión:
const guardada = await obtenerPublicacionGuardada(id); // { publicacion, fotosLocales, guardadoEn } o null
// Mostrar las fotos con <Image source={{ uri: guardada.fotosLocales[0] }} />
```

Las acciones "Es mío", "Lo encontré" y "Seguir" usan `ConnectionRequiredButton` en lugar de un `TouchableOpacity` común.

### Punto 5: publicar

Al montar la app (o la pantalla de publicar), registrar la función que envía a la API:

```js
import { registrarEnviadorPublicaciones, encolarPublicacion } from '../services/offline/pendingPublications';

registrarEnviadorPublicaciones(async datos => (await api.post('/publicaciones', datos)).data);
```

Al confirmar el formulario sin conexión: `await encolarPublicacion(user.id, datos)` (si `datos.fotos` trae URIs de expo-image-picker, se copian para que no se pierdan). Con conexión se puede enviar directo como siempre.

Si el servidor rechaza una publicación pendiente (respuesta 4xx), queda con estado `error_envio` y el mensaje del servidor, para corregirla o descartarla. Si el error es de red, se reintenta en la próxima reconexión.

### Puntos 7, 9 y otros

Cualquier acción que necesite la API (reclamar, aceptar un reclamo, seguir una publicación) usa `ConnectionRequiredButton`. Para lógica propia, `const { isOnline } = useConnectivity()`.

## Probar desde Android

1. Backend: `npm run dev` en `backend/`. App: `npx expo start --go --clear` en `mobile/` y presionar `a`.
2. Iniciar sesión → "Modo sin conexión (prueba)".
3. Con conexión: abrir las dos publicaciones de ejemplo (se descargan foto, detalle y barrio), tocar "Buscar".
4. Cortar la red del emulador (en una terminal de la PC):
   ```
   adb shell svc wifi disable
   adb shell svc data disable
   ```
   Debe aparecer "Sin conexión" arriba de la pantalla y el aviso inferior.
5. Sin conexión: las publicaciones guardadas se siguen viendo con su foto; "Buscar" muestra los últimos resultados con el aviso de información desactualizada; "Es mío" y "Seguir publicación" quedan deshabilitados con el mensaje; "Crear publicación de ejemplo" la deja "Pendiente de envío".
6. Volver a conectar:
   ```
   adb shell svc wifi enable
   adb shell svc data enable
   ```
   La publicación pendiente se envía sola y desaparece de la lista ("se publicaron 1 pendiente(s)"). En la pantalla de prueba el envío es simulado porque todavía no existe `POST /publicaciones`.
7. Abrir la app ya estando sin red no se puede probar con Expo Go: Expo Go descarga el código desde Metro (la PC) por la red, así que sin conexión no arranca. En una app compilada (development build o APK), `AuthContext` conserva la sesión guardada y se ven las publicaciones guardadas.

`adb` está en `~/Library/Android/sdk/platform-tools/` (Mac) o `%LOCALAPPDATA%\Android\Sdk\platform-tools\` (Windows) si no está en el PATH.

## Nota para emulador con Expo Go

Si la app muestra "No pudimos conectar con la API" aunque el backend responde en `http://10.0.2.2:3000/health` desde el navegador del emulador, usar en `mobile/.env` la IP local de la PC (la misma que muestra Metro, por ejemplo `EXPO_PUBLIC_API_URL=http://192.168.0.4:3000`) y reiniciar Expo con `--clear`. El backend ya escucha en todas las interfaces.
