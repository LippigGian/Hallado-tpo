# Hallado-tpo

Trabajo práctico: aplicación de objetos y mascotas perdidas Hallado.

## Tecnologías

React Native con Expo SDK 58 y JavaScript. La aplicación móvil está en `mobile/`.

## Empezar

Requisitos: Node.js LTS, npm, Git y un emulador o dispositivo Android.

```powershell
git clone https://github.com/LippigGian/Hallado-tpo.git
cd Hallado-tpo/mobile
npm ci
npx expo start --go
```

Con el emulador encendido, presionar `a`. Expo Go debe ser compatible con el SDK del proyecto.

Para abrir el proyecto con una development build previamente compilada e instalada:

```powershell
npx expo start --dev-client
```

## Trabajo en equipo

`main` contiene la base compartida. Crear una rama por funcionalidad desde una versión actualizada:

```powershell
git switch main
git pull --ff-only
git switch -c feature/nombre-de-la-funcionalidad
```

Subir la rama y abrir un Pull Request hacia `main`. Después de actualizar dependencias del proyecto, ejecutar `npm ci` dentro de `mobile/`.

