# Guía — Android Studio, Google y Spotify

Configuración única para compilar la app Android y que funcione el login con Google y la conexión con Spotify (por qué se hace así: [ADR 005](adr/005-autenticacion-social.md)).
La necesita cada persona que vaya a compilar la app: tú, tu compañero y quien prepare la corrección.

> Los nombres de los menús de Google y Spotify cambian a menudo. Si algo no coincide exactamente, busca la opción equivalente.

Datos fijos del proyecto que vas a necesitar:

| Dato | Valor |
|---|---|
| Nombre del paquete Android | `com.echomusic.app` |
| Esquema de la app | `echomusic://` |
| Dirección de vuelta de Spotify | `echomusic://spotify-auth` |

---

## 1. Android Studio (SDK, emulador y Java)

1. **Descargar** Android Studio de https://developer.android.com/studio.
2. **Instalarlo** en `D:\Programas\Android Studio` (el instalador pregunta la carpeta).
3. **Primera apertura:** elige la instalación *Custom* y pon como **Android SDK Location** `D:\Desarrollo\Android\Sdk`. Deja que descargue lo que propone.
4. **Variables de entorno de usuario:** Inicio → "Editar las variables de entorno de esta cuenta". Así nada pesado acaba en `C:`.

   | Variable | Valor |
   |---|---|
   | `ANDROID_HOME` | `D:\Desarrollo\Android\Sdk` |
   | `JAVA_HOME` | `D:\Programas\Android Studio\jbr` |
   | `ANDROID_AVD_HOME` | `D:\Desarrollo\Android\avd` (los emuladores) |
   | `GRADLE_USER_HOME` | `D:\Desarrollo\Caches\gradle` (la caché de compilación, varios GB) |

   Y añade al `Path`:
   - `D:\Desarrollo\Android\Sdk\platform-tools`
   - `D:\Desarrollo\Android\Sdk\emulator`
5. **Crear el emulador:** Android Studio → *More Actions* → **Virtual Device Manager** → *Create device* → **Pixel 8** → elige una imagen que ponga **"Google Play"** (no la "Google APIs" a secas).
   - El login con Google necesita los servicios de Google Play del emulador.
6. **Comprobar:** en una terminal **nueva**, `adb version` y `java -version` deben responder.

> **Móvil Android real:** activa *Opciones de desarrollador → Depuración USB*, conéctalo por USB y acepta el aviso. `adb devices` debe listarlo.

## 2. Primera compilación de la app

Este paso lo hacemos juntos: hay que añadir `expo-dev-client` y Google Sign-In al proyecto. En resumen:

```
cd mobile
npx expo run:android
```

1. La primera vez genera la carpeta `mobile/android/` (no se sube a git), compila e instala **EchoMusic** en el emulador o móvil. Tarda varios minutos.
2. Las siguientes veces, para cambios de JavaScript basta con `make dev`, igual que con Expo Go, pero abriendo la app EchoMusic en vez de Expo Go.

**Dirección del backend:**
- **Desde el emulador:** la IP de la wifi del PC suele funcionar; si no, usa `http://10.0.2.2:3000` (el emulador llama así al PC).
- **Desde un móvil real:** `http://<IP de la wifi>:3000`, como hasta ahora.

## 3. Huella SHA-1 del certificado

Google identifica la app por su paquete y la huella SHA-1 del certificado con que se firma. Tras la primera compilación:

```
keytool -list -v -keystore mobile/android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

Copia la línea `SHA1: AA:BB:...`.

> Si más adelante firmáis el APK de la corrección con otra clave, hay que añadir también **su** SHA-1 en Google Cloud (paso 4.4).

---

## 4. Google Cloud (login con Google)

1. **Crear el proyecto:** entra en https://console.cloud.google.com, con la cuenta del proyecto (`musicroomurduliz42@gmail.com`), y crea un proyecto nuevo, por ejemplo `EchoMusic`.
2. **Configurar la pantalla de consentimiento:** **APIs y servicios → Pantalla de consentimiento de OAuth** (en la consola nueva: **Google Auth Platform**).
   - **Información de la app:**
     - nombre `EchoMusic`
     - correo de asistencia: el del proyecto
   - **Público / Audience:** *Externo*.
   - **Estado:** **Pruebas / Testing**. Así no hace falta que Google revise la app.
   - **Usuarios de prueba:** añade los Gmail con los que vayáis a probar (el tuyo, el de tu compañero, el del proyecto y la cuenta Google del emulador). Ninguna otra cuenta podrá entrar.
   - **Permisos:** los básicos, `openid`, `email` y `profile`.
3. **Cliente de tipo Web:** **Clientes → Crear cliente → Aplicación web**.
   - **Nombre:** `EchoMusic backend`.
   - **No hace falta** poner orígenes ni *redirect URIs*.
   - Copia el **ID de cliente** (`xxxx.apps.googleusercontent.com`) y ponlo en `backend/.env`:
     ```
     GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
     ```
   - La app lo recibe del backend al arrancar con `make dev`; no hay que ponerlo en otro sitio.
4. **Cliente de tipo Android:** **Crear cliente → Android**.
   - **Nombre del paquete:** `com.echomusic.app`.
   - **Huella SHA-1:** la del paso 3.
   - Este ID **no se copia a ningún sitio**: sirve para que Google reconozca la app.

---

## 5. Spotify (conectar cuenta y login con Spotify)

Ya tenéis una app en el Dashboard: es la de `SPOTIFY_CLIENT_ID`.

1. **Abrir la app:** https://developer.spotify.com/dashboard → tu app → **Settings → Edit**.
2. **Redirect URIs:** añade `echomusic://spotify-auth`. **No borres** `http://127.0.0.1:3000/callback`, que es la que usa `get-spotify-token.js`. Guarda.
   - Si el Dashboard rechazara el esquema `echomusic://`, avísame: hay alternativa.
3. **APIs used:** que esté marcada **Android** y **Web API**.
   - Si pide nombre de paquete y SHA-1 para Android, usa los mismos de arriba.
4. **User Management:** añade el **nombre y el email de la cuenta de Spotify** de cada persona que vaya a conectar Spotify, incluido quien corrija.
   - En modo desarrollo, Spotify **rechaza a cualquier cuenta que no esté en esta lista**.
   - El cupo es pequeño; mira el número que muestra la pestaña.

---

## Problemas típicos

| Síntoma | Causa probable |
|---|---|
| `adb` o `java` "no se reconoce" | Terminal abierta antes de crear las variables: abre una nueva |
| La compilación dice `SDK location not found` | Falta `ANDROID_HOME` |
| Google: `DEVELOPER_ERROR` al iniciar sesión | El paquete o la SHA-1 del cliente Android no coinciden con los de la app instalada |
| Google: no aparece ninguna cuenta / falla en el emulador | La imagen del emulador no es "Google Play", o no hay cuenta de Google añadida en el emulador |
| Google: "acceso bloqueado" | Ese Gmail no está en **Usuarios de prueba** |
| La app no conecta con el backend en el APK final | Falta permitir HTTP (`usesCleartextTraffic`); se configura en la Fase 2 |
| Spotify: `INVALID_CLIENT: Invalid redirect URI` | Falta `echomusic://spotify-auth` o hay una errata |
| Spotify: error 403 al conectar | Esa cuenta de Spotify no está en **User Management** |
