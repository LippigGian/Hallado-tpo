# Recuperación de contraseña

Flujo real disponible en la app: Login -> Olvidé mi contraseña -> email -> código -> nueva contraseña -> volver al Login.

## API (POST)

- `/auth/password-reset/request-code`: `{ "email": "usuario@ejemplo.com" }`. Devuelve 202 con el mismo mensaje para cuenta existente o inexistente. Solo envía si existe una cuenta. Reenviar usa este mismo endpoint; no envía otro correo antes de 30 segundos.
- `/auth/password-reset/verify-code`: `{ "email": "usuario@ejemplo.com", "code": "123456" }`. Si el código real es válido devuelve `{ "resetToken": "...", "expiresIn": 600 }`.
- `/auth/password-reset/complete`: `{ "resetToken": "...", "password": "nueva-contraseña", "passwordConfirmation": "nueva-contraseña" }`. Devuelve 200 al cambiar la contraseña.

El código mostrado arriba es ilustrativo: usar el que llega por correo. El asunto es **Hallado: recuperá tu contraseña**. Usa la misma configuración Brevo/SMTP que el registro.

OTP: cinco minutos, cinco intentos incorrectos como máximo. Permiso de cambio: diez minutos, un solo uso. Reenviar invalida códigos y permisos anteriores. Contraseñas de 8 a 128 caracteres, no solo espacios, con confirmación idéntica. Los permisos de registro no permiten recuperar una cuenta ni viceversa.

Migración `003_password_recovery.sql`: agrega reset_token_hash y users.session_version. Al cambiar contraseña se incrementa la versión; /auth/me rechaza los JWT anteriores. Las futuras rutas protegidas deberán validar también esa versión, además de la firma y expiración. La app vuelve a validar al restaurar sesión; no hay notificación remota que cierre instantáneamente la pantalla de otro dispositivo.

## Probar desde Android

1. Reiniciar backend con `npm run dev`; recargar Expo con `r`.
2. En Login, tocar Olvidé mi contraseña.
3. Ingresar un email de una cuenta ya creada que controles.
4. Copiar el código recibido en Brevo/email, verificarlo y definir la nueva contraseña.
5. Volver al Login: contraseña anterior rechazada; nueva contraseña aceptada.
6. Probar código incorrecto, reenvío, confirmación distinta y API apagada.

No se imprimen OTP con MAIL_MODE=smtp. No compartir permisos ni contraseñas. En desarrollo puede usarse MAIL_MODE=console para pruebas locales explícitas.

## Verificación

`npm run test:recovery`: 33 comprobaciones HTTP con PostgreSQL y correo simulado. Cubre cuentas inexistentes, intentos, expiración, reenvío, permisos separados, validaciones, uso único, login nuevo y rechazo de sesión anterior. La transacción se revierte: no altera cuentas existentes ni envía emails.
