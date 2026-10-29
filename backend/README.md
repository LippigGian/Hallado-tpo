# Backend de Hallado

API propia en JavaScript con Node.js 24+, Express y PostgreSQL. No requiere Docker.

## Iniciar en PowerShell

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run dev
```

Copiar `.env` solo la primera vez; no sobrescribirlo si ya configuraste credenciales. `npm start` inicia sin recarga automática. Detener con Ctrl+C.

Abrir http://localhost:3000/health. Debe responder:

```json
{"status":"ok","service":"hallado-api"}
```

## PostgreSQL

No se instala ni se crea una base automáticamente. Se necesita una base PostgreSQL local o alojada, con usuario y contraseña. Completar `DATABASE_URL` en `.env` usando los datos reales y las opciones TLS indicadas por el proveedor. No desactivar la validación de certificados.

```powershell
npm run db:check
```

También se puede abrir http://localhost:3000/health/db:

- 200 y `connected`: la consulta `SELECT 1` funcionó.
- 503 y `not_configured`: falta DATABASE_URL.
- 503 y `disconnected`: la conexión o consulta falló.

`/health` comprueba el servidor HTTP; no indica que la base esté disponible. `/health/db` no crea ni modifica tablas.

## Desde el emulador Android

Usar `http://10.0.2.2:3000/health` para acceder al servidor de la PC desde el emulador estándar. `localhost` dentro de Android apunta al propio emulador.

## Verificar

```powershell
npm test
```

Las pruebas cubren HTTP, configuración y estados de conexión con un sustituto de base; no prueban una instancia PostgreSQL real. La conexión real se verifica con `db:check`.

## Alcance actual

Servidor, configuración, conexión, diagnóstico y migraciones de usuarios/verificaciones. Registro, login, tokens y envío de emails se implementarán después. No hay secretos JWT porque todavía no se emiten tokens. `.env` y `node_modules` están excluidos del repositorio.

## Migraciones

```powershell
npm run db:migrate
```

Usa DATABASE_URL de `.env`. Aplica todos los archivos pendientes en una transacción, con bloqueo para evitar que dos ejecuciones simultáneas creen lo mismo. No ejecuta migraciones al iniciar la API.

- `001_auth.sql`: usuarios y verificaciones de registro/recuperación.
- `schema_migrations`: historial y checksum de cada archivo aplicado.
- No editar ni eliminar migraciones aplicadas: crear otra, por ejemplo `002_profile.sql`.
- Guardar los archivos SQL en Git, sin credenciales. Todos deben actualizar el repositorio antes de migrar.
- Usuarios: email normalizado en minúsculas y único; contraseña como hash. La cuenta se crea después de verificar email y definir contraseña.
- Verificaciones: email, propósito, hash del OTP, intentos, vencimiento, verificación y consumo. La lógica de verificar, reenviar e invalidar códigos se implementará en la API; las tablas por sí solas no ejecutan ese flujo.
- `verified_at` indica que el OTP fue validado; `used_at`, que se completó la operación. Se distinguirán ambos pasos en la API.

Se verificó en la base configurada la aplicación inicial, la segunda ejecución sin pendientes y las restricciones de email único, propósito, vencimiento e intentos. Los datos usados en esas comprobaciones se descartaron mediante ROLLBACK.

## Registro por email

Endpoints implementados: `/auth/register/request-code`, `/auth/register/verify-code` y `/auth/register/complete` (POST). Ver `../docs/registro-api.md` para cuerpos, respuestas, configuración del correo y pruebas.

La migración `002_registration_token.sql` agrega el hash del permiso de registro. En desarrollo se configuró MAIL_MODE=console: el código se muestra en la terminal y no se envía correo. No conectar el modo demo fijo del frontend a datos reales; la integración usará el código generado por esta API.

## Login

POST `/auth/login` valida las credenciales y devuelve JWT de una hora. Requiere JWT_SECRET en `.env`. Documentación y ejemplo PowerShell: `../docs/login-api.md`. Verificación integral contra PostgreSQL: `npm run test:login`.

## Recuperación

POST `/auth/password-reset/request-code`, `/verify-code` y `/complete`. Documentación: `../docs/recuperacion-api.md`. Aplicar migraciones antes de arrancar. Prueba integral: `npm run test:recovery`. El cambio de contraseña invalida las sesiones previas mediante session_version.

## Perfiles

Punto 2: edición privada, foto de galería, perfil público, reputación e insignias. Consultar `../docs/perfiles.md` para endpoints e integración interna con reclamos, devoluciones y valoraciones. Verificar con `npm run test:profiles`.
