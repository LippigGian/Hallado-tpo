# Autenticación conectada a la API

La app utiliza Axios, AuthContext, SecureStore y React Navigation siguiendo las clases. Registro y login son reales. Recuperación también está conectada; el desbloqueo biométrico está implementado (ver biometria.md).

## Ejecutar

Terminal 1, desde `backend/`: `npm ci` y `npm run dev`. Requiere su `.env` privado con Neon, JWT_SECRET, OTP_SECRET y SMTP de Brevo. Reiniciar la API para cargar GET /auth/me.

Terminal 2, desde `mobile/`: `npm ci` y `npx expo start --go --clear`. Presionar `a` con el emulador encendido. SecureStore está incluido en Expo Go. Una development build anterior deberá recompilarse si todavía no contiene ese módulo.

La URL está en `mobile/.env`: EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 (Android Emulator). Para un teléfono físico usar la IP LAN de la PC; para producción usar HTTPS. Copiar `.env.example` si falta `.env`. Este archivo móvil contiene solo la URL pública: nunca copiar credenciales del backend aquí.

## Probar en Android

1. Ingresar con email/contraseña existentes. Debe mostrar la pantalla de inicio provisoria con el email.
2. Cerrar sesión. Debe regresar a Login y permitir ingresar otra vez.
3. Cerrar/reabrir la app antes de una hora: restaura con SecureStore y consulta /auth/me para validar el token en el servidor. Si la API está apagada, no permite restaurar y muestra un mensaje.
4. Crear cuenta con un email nuevo: solicitar código, buscar el email de Brevo, verificarlo y elegir contraseña. Esta acción crea un usuario real en Neon.
5. Volver e ingresar con la nueva cuenta. Un email ya registrado da un error explícito.
6. Probar contraseña incorrecta, campos vacíos, código inválido, reenvío anticipado y API apagada. Los errores no deben permitir entrar.
7. Recuperación: solicitar código para una cuenta existente, verificar el email y cambiar contraseña. Ingresar con la nueva; la anterior debe fallar. Ver recuperacion-api.md.

La sesión dura una hora y se borra al cerrar sesión. No hay refresh token ni revocación en el servidor todavía. Los tokens se mantienen en almacenamiento seguro; las contraseñas no se guardan. El permiso de registro se mantiene solo en memoria.

## Verificación automática realizada

Bundle Android y compatibilidad de dependencias correctos. Diez tests backend y prueba HTTP/PostgreSQL de login pasaron, incluida validación de /auth/me para JWT válido, vencido, inválido y usuario inexistente. La plantilla móvil no tiene configurados scripts de lint/typecheck; no se agregaron herramientas ajenas a la clase. El recorrido táctil completo queda para la prueba en el emulador.
