# Autenticación: prototipo visual

Implementado con JavaScript, React Native, React Navigation y hooks de React, siguiendo el material de clase.

## Probar

Desde `mobile/`: `npm ci` y `npx expo start --go`. Abrir Android con `a`.

- Login: probar campos vacíos, email inválido y datos completos. No inicia sesión.
- Registro: email -> código -> contraseña y confirmación -> fin del recorrido.
- Recuperación: email -> código -> nueva contraseña y confirmación -> fin del recorrido.
- Código demo: `123456`. Cualquier otro código debe mostrar un error.
- Código incompleto: se requieren seis dígitos. Expira a los cinco minutos.
- Reenvío: se habilita después de 30 segundos y reinicia la vigencia.
- Cambiar email: vuelve al primer paso; continuar genera otro intento demo.
- Contraseñas: mínimo provisional de ocho caracteres, no solo espacios, confirmación idéntica. Verificar mostrar/ocultar.
- Probar volver con la flecha del encabezado y con el botón Android; terminar vuelve al Login.
- Probar formulario con teclado abierto y en pantalla pequeña.

No se envían emails, no se crean cuentas, no se cambia ninguna contraseña y no se guardan contraseñas ni tokens. La demostración se identifica en las pantallas. Los tiempos y requisitos son provisionales.

## Pendiente para la integración

API propia y reglas del servidor, Axios y manejo de carga/errores HTTP, OTP real y límites de intentos/reenvío, AuthContext, SecureStore, expiración de sesión y configuración de desbloqueo biométrico. El servidor deberá decidir si el email y el OTP son válidos; las validaciones locales no otorgan acceso.

## Verificación realizada

Bundle Android generado correctamente y siete casos de validación de email/contraseña comprobados. La plantilla no tiene configurados lint ni typecheck. El recorrido táctil completo todavía debe probarse en el emulador siguiendo los casos anteriores.
