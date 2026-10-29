# Hallado: guía para levantar el proyecto

Instructivo para el equipo. Comandos para Windows PowerShell.

> Antes de usar `main`, confirmar que el Pull Request de autenticación y backend ya fue integrado. Si todavía no lo fue, coordinar con el equipo qué rama utilizar.

## 1. Requisitos

- Git.
- Node.js 24 LTS (incluye npm).
- Android Studio con un emulador configurado, o celular Android con Expo Go compatible con Expo SDK 58.
- Conexión a internet para Neon y el envío de códigos por Brevo.
- Archivo `.env` del backend, recibido por privado del responsable del proyecto.

No es necesario instalar PostgreSQL ni Docker. La base PostgreSQL está alojada en Neon y es compartida.

Comprobar las herramientas:

```powershell
node --version
npm --version
git --version
```

Si PowerShell bloquea `npm.ps1`, usar `npm.cmd` en lugar de `npm` y `npx.cmd` en lugar de `npx`.

## 2. Clonar el repositorio

```powershell
git clone https://github.com/LippigGian/Hallado-tpo.git
cd Hallado-tpo
git switch main
git pull --ff-only origin main
```

Si ya está clonado, entrar en su carpeta y ejecutar solo los dos últimos comandos, conservando antes los cambios propios. No es necesario volver a clonar.

## 3. Configurar y ejecutar el backend

Copiar el `.env` recibido por privado dentro de `backend/`. Verificar que el nombre sea exactamente `.env`, no `.env.txt`.

```text
Hallado-tpo/
├── backend/
│   ├── .env           <- archivo privado recibido
│   ├── package.json
│   └── src/
└── mobile/
```

En una terminal, desde la raíz del repositorio:

```powershell
cd backend
npm ci
npm run db:check
npm run dev
```

La comprobación debe indicar `Conexión con PostgreSQL correcta.` Mantener esta terminal abierta: allí se ejecuta la API y aparecen sus mensajes.

Abrir http://localhost:3000/health en el navegador. Respuesta esperada:

```json
{"status":"ok","service":"hallado-api"}
```

http://localhost:3000/health/db debe indicar `connected` si la base está disponible.

Las tablas existentes ya están creadas en la base compartida. No ejecutar ni modificar migraciones nuevas sin coordinarlo. El comando `npm run db:migrate` aplica cambios a la base de todos, no a una copia personal.

## 4. Configurar la app móvil

Abrir una segunda terminal desde la raíz del repositorio:

```powershell
cd mobile
npm ci
```

Solo si todavía no existe `mobile/.env`, crearlo copiando el ejemplo:

```powershell
Copy-Item .env.example .env
```

Para Android Emulator, debe contener:

```dotenv
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

`10.0.2.2` permite acceder a la PC desde el emulador estándar de Android Studio. `localhost` dentro de Android apunta al propio dispositivo, no a la PC.

**No copiar el `.env` del backend dentro de `mobile/`.** En la app va únicamente la URL pública de la API. Las credenciales de Neon, Brevo y los secretos de autenticación permanecen en el backend.

## 5. Ejecutar en el emulador

1. Abrir Android Studio y entrar a Device Manager.
2. Crear un dispositivo virtual si no tienen uno y encenderlo con el botón de ejecución.
3. Desde la terminal ubicada en `mobile/`, ejecutar:

```powershell
npx expo start --go --clear
```

4. Presionar `a` para abrir el proyecto en Android. Expo puede ofrecer instalar Expo Go compatible con el SDK.
5. Mantener también esta terminal abierta. Guardar cambios en el código actualiza la app; `r` permite recargarla.

Para iniciar un emulador sin abrir Android Studio, con sus herramientas en el PATH:

```powershell
emulator -list-avds
emulator -avd NOMBRE_DE_SU_DISPOSITIVO
```

Cada integrante debe usar el nombre de su propio dispositivo virtual.

### Alternativa: celular físico

- Instalar Expo Go compatible con SDK 58.
- Conectar celular y PC a la misma red Wi-Fi.
- Consultar la IP local de la PC con `ipconfig`.
- En `mobile/.env`, reemplazar la URL por `http://IP_LOCAL_DE_LA_PC:3000`.
- Recargar Expo y escanear el QR con Expo Go.
- Si Windows solicita acceso de red, permitirlo en la red privada de confianza. No desactivar el firewall.

La URL depende de cada PC y puede cambiar al reconectarse a la red.

## 6. Crear su cuenta y probar

Cada integrante se registra en la app con un email propio que controle:

1. Crear cuenta: ingresar email, recibir el código por Brevo y verificarlo.
2. Elegir y confirmar una contraseña exclusiva para Hallado.
3. Volver al Login e ingresar.
4. Comprobar que Inicio muestre el email correcto.
5. Cerrar sesión y volver a ingresar.
6. Cerrar completamente y reabrir la app con el backend activo para verificar la restauración de la sesión.
7. Probar Olvidé mi contraseña con una cuenta existente: recibir código, verificar y definir una nueva contraseña.

Revisar spam si no aparece el mensaje. Los códigos vencen a los cinco minutos. El reenvío se habilita después de treinta segundos. La sesión dura una hora.

Registro, login, cierre de sesión y recuperación están conectados a la API. El desbloqueo biométrico se activa desde Configuración; requiere biometría registrada en Android. Ver biometria.md. Las cuentas y cualquier cambio de datos son reales y compartidos en Neon.

## 7. Crear una rama para su funcionalidad

Desde la raíz del repositorio, sin cambios locales pendientes:

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/nombre-de-la-funcionalidad
```

Trabajar en esa rama. Al terminar, hacer commit de los archivos revisados, subir la rama y abrir un Pull Request hacia `main`.

Si actualizaron archivos de dependencias al descargar cambios, ejecutar `npm ci` en la carpeta afectada (`mobile/`, `backend/` o ambas).

## 8. Rutina diaria

No es necesario reinstalar todo en cada sesión:

1. Abrir el emulador.
2. En `backend/`: `npm run dev`.
3. En otra terminal, en `mobile/`: `npx expo start --go` y presionar `a`.
4. Detener los servidores con Ctrl+C al terminar.

## 9. Problemas habituales

| Problema | Qué comprobar |
| --- | --- |
| Puerto 3000 ocupado | Puede haber otro backend encendido. Detenerlo con Ctrl+C en su terminal; no iniciar dos instancias. |
| La app no conecta | Backend activo, URL correcta en `mobile/.env` y conectividad con la PC. |
| Conexión a PostgreSQL fallida | Internet y `.env` privado correcto. Ejecutar `npm run db:check`. |
| Expo no encuentra `App.js` | Ejecutar Expo desde `mobile/`, donde está su `package.json`. |
| No aparecen los cambios | Presionar `r`; si persiste, cerrar Expo Go y abrir de nuevo con `a`. |
| SDK incompatible con Expo Go | Instalar Expo Go para SDK 58 o coordinar una development build compatible. |
| No llega el código | Revisar spam y consultar al responsable para verificar los logs y el cupo de Brevo. |
| Email ya registrado | Ingresar con esa cuenta o usar recuperación de contraseña. |
| Error de permiso temporal | Solicitar y verificar un código nuevo. |

## 10. Archivos privados y base compartida

- Nunca subir `.env`, contraseñas, claves SMTP, tokens ni cadenas de conexión a GitHub.
- El `.env.example` sí se comparte: contiene nombres de variables sin credenciales.
- No agregar `node_modules/` ni `.expo/` al repositorio.
- No borrar datos ni cambiar tablas compartidas sin avisar al equipo.
- Guardar cambios de estructura en migraciones SQL nuevas; no editar las que ya fueron aplicadas.
- Para probar reclamos o devoluciones entre personas, usar cuentas distintas.
