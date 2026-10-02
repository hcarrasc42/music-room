# ADR 005 — Autenticación social: app Android propia con Google Sign-In nativo

**Fecha:** 2026-10-02  
**Estado:** Aceptado (sustituye a una primera versión del mismo día; ver *Historial*)

## Contexto
- **Login social:** el subject exige registro e inicio de sesión con una red social (Facebook o Google), implementado **en la app móvil** (V.1, V.5), y poder **vincular** esa red a una cuenta existente.
- **Spotify por usuario:** para crear eventos cada usuario necesita conectar **su** cuenta de Spotify Premium; hasta ahora había una sola cuenta global en `.env`.
- **Plataforma:** el subject permite elegir **Android o iOS** (IV.2). La corrección se hará en un **Android** (móvil o emulador).

Hasta ahora la app se probaba con **Expo Go**. Expo Go no permite incluir SDKs nativos (como Google Sign-In) ni registrar un esquema de URL propio, que es donde Google y Spotify devuelven al usuario tras el login.

## Opciones consideradas
- **A. Seguir con Expo Go + OAuth desde el backend a través de un túnel HTTPS (ngrok)**
- **B. App Android propia (*development build* con `expo-dev-client`) + Google Sign-In nativo + esquema `echomusic://`**
- C. OAuth en el cliente con `expo-auth-session` dentro de Expo Go (lo que había, nunca configurado)

## Decisión
**Opción B.**

**Google:**
1. La app usa `@react-native-google-signin/google-signin`, que abre el selector de cuentas nativo de Android.
2. Google devuelve un **ID token** firmado por Google.
3. La app lo envía a `POST /auth/google`.
4. El backend verifica la firma y que el token va dirigido a nuestro cliente (`GOOGLE_CLIENT_ID`). Después crea, inicia sesión o vincula la cuenta.

**Spotify** (conectar la cuenta y, más adelante, iniciar sesión):
1. La app abre la autorización de Spotify con **PKCE** y la dirección de vuelta `echomusic://spotify-auth`.
2. Spotify vuelve a la app con un `code`.
3. La app envía el `code` (y el `code_verifier`) al backend.
4. El backend lo canjea con su *client secret* y guarda los tokens **cifrados**.

## Justificación
- **Encaja con la corrección:** el subject pide una app para Android o iOS y se evaluará en Android. Una app instalable propia es lo que se espera de "una solución móvil completa"; Expo Go es una herramienta de desarrollo.
- **Menos piezas externas:** no hace falta túnel ni dominio público. Google valida la app por su **nombre de paquete + huella SHA-1** del certificado, sin *redirect URIs*.
- **Mejor experiencia:** selector de cuentas nativo de Android, sin pasar por el navegador.
- **Backend sencillo y ya existente:** `POST /auth/google` con ID token ya estaba hecho; solo hay que endurecerlo (comprobar `email_verified`).
- **Los secretos siguen solo en el servidor:** el *client secret* de Spotify y los tokens de Spotify nunca están en el móvil. Encaja con "la app es un mando a distancia" (V.5) y "el backend es la única fuente de verdad" (V.3).

## Por qué no A
- Añade un servicio externo (ngrok) que tiene que estar levantado para poder entrar.
- Sigue dependiendo de Expo Go para la corrección.
- La única ventaja real era poder probar en iPhone sin Mac, y no es un requisito.

## Por qué no C
- Expo Go no tiene una dirección de vuelta fija que registrar en Google.
- Para Spotify obligaría a manejar los tokens en el móvil.

## Consecuencias aceptadas
- **Recompilar:** al añadir o cambiar algo nativo hay que compilar de nuevo la app (`npx expo run:android`). Los cambios de JavaScript siguen recargándose al momento, como en Expo Go.
- **Hace falta Android Studio** (SDK, emulador y JDK) en el PC que compila.
- **Las carpetas `android/` e `ios/` se generan** (`expo prebuild`) y **no se suben a git**: no son código nuestro y el subject prohíbe subir lo que no hemos escrito.
- **Huella SHA-1:** Google exige registrar la del certificado con el que se firma la app. Hay que registrar la de *debug* y, si se firma el APK de la corrección con otra clave, también esa.
- **Modos de prueba:** en Google (consentimiento en *Testing*) y Spotify (*Development mode*) solo pueden entrar las cuentas añadidas a mano.
- **Backend por HTTP:** el APK de *release* bloquea por defecto el HTTP sin cifrar; hay que permitirlo con `expo-build-properties` (`usesCleartextTraffic`) para usar la IP de la wifi.

## Historial
La primera versión de este ADR (mismo día) eligió la opción A, porque se suponía que se probaría en un iPhone sin Mac. Al revisarla con el equipo:
- la corrección será en Android, que el subject permite
- conviene no depender de Expo Go

Con esas restricciones B es más simple y robusta, y se cambió antes de escribir código de OAuth. El único coste fue retirar la integración del túnel en `make dev`.
