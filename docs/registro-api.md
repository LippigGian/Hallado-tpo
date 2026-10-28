# Registro por email

La API usa PostgreSQL real. El envío se configura con MAIL_MODE; no existe un OTP fijo de demostración en el backend.

## Configuración local

En `backend/.env`:

```dotenv
MAIL_MODE=console
OTP_SECRET=un-secreto-aleatorio-de-al-menos-32-caracteres
```

El secreto ya fue generado localmente. Compartirlo por privado con quienes usen esta base. Todos deben usar el mismo OTP_SECRET para validar códigos generados por otros servidores. No publicarlo ni regenerarlo en cada arranque.

Modo `console`: el OTP aparece solo en la terminal del backend y no llega a la casilla. Está bloqueado con NODE_ENV=production. Para email real configurar MAIL_MODE=smtp, SMTP_HOST, SMTP_PORT (465 o 587), SMTP_USER, SMTP_PASS y MAIL_FROM. Sin configuración de correo, el registro responde 503. El modo SMTP está implementado pero todavía no se probó con un proveedor real.

Ejecutar `npm run db:migrate` y reiniciar el servidor con `npm run dev`.

## 1. Solicitar o reenviar código

POST `/auth/register/request-code`

```json
{"email":"tu-email@ejemplo.com"}
```

202: código generado (en consola para desarrollo). Vence en cinco minutos. Esperar 30 segundos antes del reenvío. Reenviar invalida el código y el permiso de registro anteriores. 400: email inválido; 409: cuenta existente; 429: reenvío anticipado o límite de peticiones; 503: configuración, base o correo no disponibles.

## 2. Verificar código

POST `/auth/register/verify-code`

```json
{"email":"tu-email@ejemplo.com","code":"codigo-de-seis-digitos"}
```

200: `{ "registrationToken": "...", "expiresIn": 600 }`. El permiso sirve exclusivamente para completar el registro y no inicia sesión. Mantenerlo en memoria, sin logs ni URL. El OTP admite cinco intentos fallidos; después hay que solicitar otro. Un OTP validado no se puede volver a verificar. El código debe enviarse como string para conservar ceros iniciales.

## 3. Definir contraseña y crear cuenta

POST `/auth/register/complete`

```json
{
  "registrationToken":"permiso-obtenido-en-el-paso-anterior",
  "password":"una-clave-de-8-a-128-caracteres",
  "passwordConfirmation":"una-clave-de-8-a-128-caracteres"
}
```

201: cuenta creada y datos públicos mínimos del usuario. No devuelve contraseña, hash ni sesión. La contraseña debe coincidir con la confirmación y no contener solo espacios. El permiso vence a los diez minutos de verificar el OTP y solo se consume una vez. 400: campos inválidos o permiso vencido/usado; 409: email registrado.

## Implementación y pruebas

Contraseñas: scrypt con salt aleatorio. OTP: HMAC SHA-256 con OTP_SECRET. Permisos: 32 bytes aleatorios; solo su hash se guarda en PostgreSQL. SQL parametrizado, transacciones, bloqueo por email y límite de 30 solicitudes por IP cada 15 minutos para estas rutas. El límite por IP vive en memoria: si se despliegan varias réplicas debe usarse un almacén compartido y configurar correctamente el proxy.

```powershell
npm test
npm run test:registration
```

La segunda prueba usa DATABASE_URL y OTP_SECRET, correo simulado y una transacción externa que se revierte. No deja usuarios ni envía emails. Cubre el recorrido HTTP completo, código erróneo, intentos agotados, vencimiento, reenvío, validaciones, contraseña hasheada, permiso de uso único y rollback ante fallo del correo.

Pendiente: proveedor SMTP real, login, recuperación de contraseña, sesiones y conexión desde React Native.
