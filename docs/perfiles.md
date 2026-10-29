# Punto 2: perfil y reputación

Rama `perfiles`. Implementación móvil con React Native, React Navigation, Axios y expo-image-picker (galería), siguiendo las clases. Las migraciones 004 y 005 ya se aplicaron a Neon.

## Probar desde Android

1. Reiniciar el backend desde backend/: `npm run dev`.
2. Reiniciar Metro desde mobile/: `npx expo start --go --localhost --clear`. Si el emulador no conecta, abrir manualmente `exp://10.0.2.2:8081` en Expo Go.
3. Iniciar sesión -> Mi perfil: muestra los datos guardados, contacto privado, reputación e insignias. Tocar Editar perfil para abrir el formulario.
4. En Editar perfil, cambiar nombre, barrio/localidad, teléfono o foto (JPEG/PNG, hasta 1 MB). Guardar cambios vuelve a Mi perfil y consulta los datos actualizados. Cancelar o volver sin guardar descarta el borrador.
5. Volver a entrar y comprobar persistencia. Probar quitar la foto y guardar.
6. Activar/desactivar Compartir teléfono después de aceptar un reclamo y guardar.
7. Ver mi perfil público guardado: debe mostrar nombre, foto, barrio, antigüedad, reputación e insignias, sin teléfono, email ni historial de publicaciones.
8. Probar nombre vacío, teléfono inválido, foto grande y API apagada. Debe informar errores sin simular un guardado exitoso.

Guardar antes de abrir el perfil público: la vista pública consulta los datos persistidos, no el borrador del formulario. Si el emulador no tiene imágenes, se pueden agregar arrastrando un archivo de imagen al dispositivo y seleccionarlo desde la galería. No se toma foto con cámara en este flujo.

## Endpoints

- GET `/profiles/me`: perfil privado del usuario autenticado.
- PATCH `/profiles/me`: acepta únicamente name, neighborhood, phone, share_phone_after_claim y photo. No permite modificar otro usuario, reputación, insignias o antigüedad.
- GET `/profiles/:id`: perfil público, sin campos privados. No devuelve publicaciones.
- GET `/profiles/:id/photo`: imagen pública de perfil o 404.
- GET `/profiles/:id/contact?claimId=UUID`: requiere sesión válida, permiso de contraparte de reclamo aceptado y consentimiento del dueño. Sin permiso: 403. Con permiso pero sin consentimiento o teléfono: phone=null.

Ejemplo PATCH:

```json
{
  "name":"Nombre",
  "neighborhood":"Caballito",
  "phone":"+54 11 5555 1234",
  "share_phone_after_claim":false
}
```

Para cambiar la foto incluir `photo: { "base64": "...", "mimeType": "image/jpeg" }`. Para quitarla, `photo: null`. Si se omite, no se modifica. Se guarda como bytea en PostgreSQL para simplificar el TP y compartirla entre las APIs locales; no depende de un archivo de una PC. El límite de 1 MB evita agotar almacenamiento con avatares grandes. Si el proyecto crece, migrar imágenes a almacenamiento de objetos.

## Integración con las partes del grupo

La edición, vista pública, agregación de reputación y control de acceso están implementados. Para alimentarlos con casos reales faltan los módulos de reclamos, devoluciones y valoraciones. No hay endpoints públicos para otorgarse reputación o permisos.

### Reclamos

Dentro de la MISMA transacción que acepta un reclamo, después de verificar participantes y estado:

```js
import { grantAcceptedClaimContact, revokeClaimContact } from './profile-contact.js';
await grantAcceptedClaimContact(client, claimId, publisherUserId, claimantUserId);
```

Esto autoriza ambas direcciones de consulta. Si se revoca la aceptación, llamar `revokeClaimContact(client, claimId)`. La tabla claim_contact_access es una proyección del estado validado por ese módulo; no sustituye la futura tabla de reclamos. Nunca registrar permisos desde un request sin verificar el reclamo y sus participantes. La preferencia de cada dueño se consulta en cada petición de contacto.

Desde la futura pantalla de reclamo aceptado, usar el endpoint contact para mostrar el teléfono cuando corresponda. Mientras ese módulo no exista, ninguna cuenta tiene permisos de contacto por defecto.

### Devoluciones y valoraciones

```js
import { recordReputationEvent } from './reputation.js';
await recordReputationEvent(client, {
  userId: returningUserId,
  type: 'return',
  sourceId: returnId
});
```

Usar el cliente de la transacción del módulo original y sus UUID reales:

- type='return', value=1: devolución concretada, para quien devolvió el objeto.
- type='rating', value=1 o -1, authorId=contraparte: valoración recibida. sourceId es el UUID de la valoración, estable para impedir duplicados. El módulo de valoraciones verifica plazo de siete días, pertenencia al caso y ausencia de autoevaluación.
- type='thanks', value=1, authorId=contraparte, message de hasta 300 caracteres: agradecimiento público del recuperador. sourceId es el identificador estable del agradecimiento/caso.

La combinación user_id/event_type/source_id es única: repetir una operación no suma de nuevo. Si una valoración cambia o se revoca una devolución, el módulo responsable debe actualizar/eliminar el evento correspondiente en la misma transacción; esta primera función de inserción no realiza correcciones automáticamente.

Reputación muestra devoluciones, positivas y negativas. Se adoptó como regla inicial explícita: puntos = devoluciones + positivas - negativas; puede ser negativo. La consigna no define fórmula: acordarla con el grupo/profesor antes de la entrega. Insignia Vecino solidario al llegar a 5 devoluciones; se calcula, no la asigna el cliente. Sin actividad real, los contadores son cero y no se inventan valoraciones.

Las futuras pantallas abren el perfil público con:

```js
navigation.navigate('PublicProfile', { userId: publisherUserId });
```

## Verificación

Desde backend/: `npm test` y `npm run test:profiles`. Esta última ejecuta 34 comprobaciones HTTP/PostgreSQL con usuarios temporales, fotos y eventos dentro de una transacción que se revierte; no modifica perfiles reales ni envía emails. Incluye acceso al contacto antes/después de aceptación, consentimiento y revocación, más rechazo de un JWT revocado.

Bundle Android generado correctamente. El flujo táctil y la galería deben probarse manualmente en el emulador. Una development build que no incluya expo-image-picker debe recompilarse; el módulo está disponible en Expo Go. El plugin actual no pide cámara ni micrófono; al implementar cámara para publicaciones, revisar esa configuración junto con el grupo.
