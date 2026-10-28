# Login

POST `/auth/login` con Content-Type: application/json.

```json
{"email":"tu-email@ejemplo.com","password":"tu-contraseña"}
```

200:

```json
{
  "token":"JWT-firmado",
  "tokenType":"Bearer",
  "expiresIn":3600,
  "user":{"id":"uuid","email":"tu-email@ejemplo.com","created_at":"fecha"}
}
```

- 400: cuerpo inválido, email inválido o contraseña vacía/de más de 128 caracteres.
- 401: email o contraseña incorrectos (misma respuesta para ambos), o email sin verificar.
- 429: más de diez solicitudes por IP en quince minutos. El limitador es local a cada proceso.
- 503: servicio no configurado o base no disponible.

Se normaliza solo el email; la contraseña conserva exactamente sus caracteres. No se envían hashes ni contraseñas en la respuesta. Usar HTTPS al alojar la API fuera del entorno local.

## Configuración

`JWT_SECRET` en `.env` es un secreto aleatorio de al menos 32 caracteres, independiente de OTP_SECRET. Ya se generó localmente. Compartirlo por privado entre quienes ejecuten esta API. No imprimir tokens ni guardarlos en Git. Reiniciar el servidor para leer cambios del `.env`.

JWT: HS256, emisor `hallado-api`, audiencia `hallado-mobile`, identificador de usuario en `sub`, vencimiento de una hora. `session-tokens.js` ofrece verificación de firma, vencimiento, audiencia y emisor para las futuras rutas protegidas. Decodificar un token en el cliente no sustituye esa verificación en el servidor.

Por ahora no hay refresh token, revocación ni endpoint de logout: al vencer, volver a iniciar sesión. Estas capacidades se definirán al integrar recuperación y sesiones. Cambiar JWT_SECRET invalida todos los tokens existentes.

## Probar en PowerShell

```powershell
$credencial = Get-Credential -UserName 'tu-email@ejemplo.com' -Message 'Credenciales de prueba de Hallado'
$body = @{ email = $credencial.UserName; password = $credencial.GetNetworkCredential().Password } | ConvertTo-Json
$sesion = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3000/auth/login' -ContentType 'application/json' -Body $body
Remove-Variable credencial, body
$sesion.user
$sesion.expiresIn
```

El token queda en `$sesion.token`; no pegarlo en chats. La app móvil aún no está conectada. Más adelante lo guardará con SecureStore.

## Pruebas

`npm test`: hashes correctos/incorrectos, entradas inválidas, credenciales indistinguibles, firma JWT, vencimiento, audiencia y emisor, además de salud del servidor.

`npm run test:login`: HTTP real y PostgreSQL con un usuario temporal dentro de una transacción que se revierte, más comprobación de límite 429. No modifica cuentas existentes ni envía emails.
