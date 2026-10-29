# Desbloqueo biométrico de la sesión

Implementado con expo-local-authentication, AuthContext y SecureStore, siguiendo el material de clase. Es un bloqueo local de una sesión existente: no sustituye login ni genera tokens nuevos.

## Uso

1. Iniciar sesión con email y contraseña.
2. Inicio -> Configuración -> activar Desbloqueo biométrico.
3. Confirmar con la huella del dispositivo. Si se cancela o no hay hardware/huella configurada, no se activa.
4. Pulsar Bloquear ahora para probar. También se bloquea al volver a abrir la app o al pasar por segundo plano.
5. Desbloquear con biometría. Cancelar conserva el bloqueo.
6. La alternativa Ingresar con email y contraseña elimina la sesión local y vuelve al Login.
7. Desde Configuración se puede desactivar tras autenticar. Al cerrar sesión se borra también la preferencia de esa sesión.

La sesión conserva su vencimiento de una hora. Tras una huella correcta se consulta /auth/me: un token vencido o revocado no se acepta. Si la API no está disponible, se informa el problema y se mantiene el bloqueo. No se muestran datos de usuario en la pantalla bloqueada.

## Preparar el emulador Android (paso manual)

1. En los ajustes de Android, buscar Huella digital/Fingerprint (la ubicación cambia según la versión).
2. Configurar personalmente un PIN de bloqueo si Android lo pide y registrar una huella. No es la contraseña de Hallado.
3. En los controles laterales del emulador abrir More (`...`) -> Fingerprint.
4. Seleccionar una huella, por ejemplo Finger 1, y pulsar Touch Sensor varias veces cuando Android solicite tocar el sensor para completar el registro.
5. En Hallado, usar ese mismo Finger 1 -> Touch Sensor cuando aparezca el prompt.

Documentación Android: https://developer.android.com/studio/run/emulator-extended-controls

## Verificaciones manuales

- Sin huella registrada: activar debe mostrar una explicación y dejar el interruptor apagado.
- Cancelar al activar/desactivar: conservar la configuración anterior.
- Activar y bloquear: no mostrar Inicio ni permitir volver con Atrás.
- Huella incorrecta/cancelada: seguir bloqueado y poder reintentar.
- Huella correcta: regresar a Inicio solo si la API valida el token.
- Segundo plano y reapertura: exigir desbloqueo.
- Desactivar: reapertura sin prompt biométrico y con validación normal de sesión.
- Usar contraseña desde bloqueo: volver a Login sin restaurar automáticamente el token anterior.
- Vencimiento: volver a Login; la huella no extiende la sesión.

## Compatibilidad

Android: el módulo está incluido en Expo Go. Reiniciar Metro si no detecta la dependencia. Si se usa una development build previa, recompilar al agregar este módulo. El plugin de permisos está en app.json.

iOS: Face ID requiere development build; no se puede probar Face ID con Expo Go.

## Pruebas realizadas

`node --test scripts/biometrics.test.mjs`, desde mobile: cuatro pruebas con API de hardware simulada, cubriendo ausencia de hardware/inscripción/tipos, cancelación/bloqueo, errores nativos y éxito. Bundle Android generado correctamente. La interacción real con la huella requiere la prueba manual indicada arriba; no se registró un PIN ni una huella automáticamente.
