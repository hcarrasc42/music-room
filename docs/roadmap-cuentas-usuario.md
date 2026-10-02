# Roadmap — Cuentas y usuario

**Responsable:** hcarrasc42  
**Alcance:** inicio de sesión, registro, verificación, contraseñas, login social (Google y Spotify), cuentas conectadas, perfil, amigos (parte de usuario), seguridad de la autenticación y experiencia de navegación de toda esta parte.  
**Fuera de alcance (compañero):** eventos, cola, votos, reproducción, delegación, playlists.

Leyenda: `[x]` hecho · `[ ]` pendiente · 🔴 obligatorio del subject · 🟡 necesario para el proyecto (lo pide otra parte) · 🟢 mejora / extra

---

## Estado actual (2026-10-02)

| Funcionalidad | Estado |
|---|---|
| Registro email + contraseña + nombre de usuario | ✅ Funciona |
| Verificación de email con código de 6 dígitos | ✅ Funciona (Gmail real) |
| Recuperar contraseña con código | ✅ Funciona (probado) |
| Perfil con visibilidad pública / amigos / privada | ✅ Backend y app (falta poder ver el perfil de otro) |
| Amigos: buscar por @usuario, solicitudes, aceptar | ✅ Funciona |
| Login con Google | ❌ El backend (`POST /auth/google` con ID token) existe, pero **nunca se ha configurado**, y en Expo Go no puede funcionar |
| Vincular red social desde el perfil | ❌ No existe |
| Spotify por usuario | ❌ Hoy hay **una sola cuenta de Spotify global** en `.env` (`SPOTIFY_REFRESH_TOKEN`) que usan todos los eventos |
| URL del backend configurable | ✅ Desde el login (⚙️) y desde el perfil, con "Probar conexión" |
| Cerrar sesión | ✅ Revoca la sesión en el servidor; también "en todos los dispositivos" |
| Rate limiting en login/códigos | ✅ Por IP y bloqueo por cuenta |

---

## Decisión previa: app Android propia, sin Expo Go

Detalle y alternativas en [ADR 005](adr/005-autenticacion-social.md).

- **Plataforma:** la corrección será en **Android** (móvil o emulador), que el subject permite (IV.2: "Android o iOS").
- **App propia:** se compila con `expo-dev-client` (`npx expo run:android`) en vez de usar Expo Go. Expo Go no admite SDKs nativos ni un esquema de URL propio.
- **Google:** SDK nativo `@react-native-google-signin/google-signin`.
  1. El selector de cuentas de Android devuelve un **ID token**.
  2. La app lo envía a `POST /auth/google`.
  3. El backend lo verifica contra `GOOGLE_CLIENT_ID` (cliente *Web*).
  - Google reconoce la app por **paquete `com.echomusic.app` + SHA-1**. Sin túnel ni *redirect URIs*.
- **Spotify:** autorización con **PKCE** y vuelta a `echomusic://spotify-auth`. La app manda el `code` al backend, que lo canjea con su secreto y guarda los tokens cifrados.
- **Carpetas `android/` e `ios/`:** son generadas y **no se suben** a git.

> Primera versión de esta decisión: OAuth por el backend con túnel ngrok (para Expo Go en iPhone). Se cambió el mismo día al confirmar que la corrección es en Android.

---

## Fase 0 — Preparación

- [x] **ADR 005** (app Android propia + Google Sign-In nativo) y guía paso a paso `docs/guia-android-google-spotify.md`.
- [x] **`app.json`:** nombre `EchoMusic` y paquete Android `com.echomusic.app`. `android/` e `ios/` en `.gitignore`.
- [x] **`.env`:** `TOKEN_ENCRYPTION_KEY` (para cifrar los tokens de Spotify). `make install` añade a un `.env` existente las variables que le falten y genera la clave.
- [ ] **Android Studio (lo haces tú):** SDK en `D:DesarrolloAndroidSdk`, variables de entorno y emulador con imagen **Google Play** (guía, paso 1).
- [ ] **Primera compilación de la app (juntos):** añadir `expo-dev-client` y `npx expo run:android` (guía, paso 2).
- [x] **Google Cloud:** proyecto creado (como `MusicRoom`; el nombre interno da igual), consentimiento en *Testing* con usuarios de prueba, cliente **Web** (ID en `GOOGLE_CLIENT_ID` de `backend/.env`).
- [ ] **Google Cloud, cliente Android** con `com.echomusic.app` + SHA-1 (necesita la primera compilación; guía, pasos 3–4).
- [ ] **Google Cloud:** cambiar el **nombre de la app** en la pantalla de consentimiento a `EchoMusic` (es el que ve el usuario al entrar con Google).
- [ ] **Spotify Dashboard (lo haces tú):** redirect `echomusic://spotify-auth` y cuentas en *User Management* (guía, paso 5).
  - ⚠️ **Limitación de Spotify:** en *Development mode* solo pueden conectar su Spotify las cuentas añadidas a mano en *User Management*. El modo producción (*extended quota*) solo se concede a empresas, así que para el proyecto no es posible. El código permite a cualquiera conectar su cuenta, pero en la demo hay que usar cuentas añadidas (las vuestras o la del evaluador, añadida antes). Documentarlo en la defensa.
- [ ] **Contrato con el compañero:** acordar el contrato Spotify ↔ eventos (sección *Contrato con eventos* al final).

---

## Fase 1 — Cerrar lo obligatorio de cuenta que ya casi está 🔴

Rápido y sin dependencias externas. Hacerlo primero.

- [x] 🔴 **URL del backend accesible antes del login** (V.5): icono de ajustes en la pantalla de bienvenida/login. Si la URL está mal, ahora mismo no hay forma de entrar.
- [x] 🔴 **Cambiar contraseña estando logueado** (V.1): pide la actual y la nueva, y cierra las demás sesiones.
- [x] 🔴 **Logout real** (V.6, robo de sesión): `POST /auth/logout` revoca el refresh token; añadir también "Cerrar sesión en todos los dispositivos".
- [x] 🔴 **Rate limiting real** (V.6, fuerza bruta):
  - activar `ThrottlerGuard` global
  - límite más estricto en `login`, `register`, `forgot-password`, `verify-email`, `reset-password` y `resend-verification`
  - bloqueo temporal por cuenta tras N contraseñas fallidas
- [x] 🔴 **`JWT_SECRET` fuerte:** `make install` lo genera aleatorio si sigue el de ejemplo.
- [x] 🔴 **Logs con plataforma, dispositivo y versión** (V.6):
  - registrar el `LoggingInterceptor`, que existe pero no está activo
  - sacar la versión de la app de `expo-constants`, no el `'1.0.0'` fijo
  - Es transversal: acordar con el compañero, pero está muy ligado a sesión y dispositivo.
- [x] 🟢 Todos los mensajes del backend de auth en español (quedan `Invalid refresh token`, `If the email exists...`).

**Hecho cuando:** se puede cambiar la URL sin estar logueado, el logout invalida la sesión en el servidor, 20 logins fallidos seguidos devuelven 429 y cada petición deja una fila en `action_logs` con plataforma, modelo y versión.

---

## Fase 2 — Login / registro con Google 🔴

Obligatorio (V.1 + V.5: "registro con mail/contraseña **o** red social" y "autenticación vía red social en la app").

- [ ] **Backend** (`POST /auth/google` ya existe; endurecerlo):
  - comprobar `email_verified` del token: solo con email verificado se vincula a una cuenta existente con el mismo email
  - normalizar el email a minúsculas
  - identificar por `sub` de Google, no solo por email
- [ ] **App:** `expo-dev-client` + `@react-native-google-signin/google-signin`; el ID del cliente Web llega a la app desde `backend/.env` vía `make dev`.
- [ ] **APK para la corrección:** permitir HTTP al backend con `expo-build-properties` (`usesCleartextTraffic`) y documentar cómo generarlo.
- [ ] **Usuario nuevo con Google:** se crea la cuenta y pasa a una pantalla corta de onboarding para elegir **nombre de usuario** (hoy recibe `usuario_123456` y no se entera).
- [ ] **Si el email ya existe con contraseña:** se vincula y entra. El aviso "Hemos conectado Google a tu cuenta" sale una sola vez.
- [ ] **App:** botón "Continuar con Google" (con el logo oficial y siguiendo las guías de marca de Google) en la bienvenida y en el login.
- [ ] Quitar el flujo antiguo de `expo-auth-session/providers/google` del login.
- [ ] **Tests:** usuario nuevo, email existente verificado, email no verificado, token de otro cliente (audiencia incorrecta).

**Hecho cuando:** en el emulador Android (y en un móvil Android) se puede crear cuenta con Google y volver a entrar con Google.

---

## Fase 3 — Cuentas conectadas (Spotify y Google desde el perfil) 🔴🟡

Cubre "un usuario registrado puede **vincular** su cuenta de red social" (V.1, 🔴) y lo que necesita tu compañero: **crear un evento requiere Spotify Premium** (🟡).

### 3.1 Backend

- [ ] **Entidad `LinkedAccount`:**
  - `userId`, `provider` (`google` | `spotify`), `providerUserId` (único por proveedor), `email`, `displayName`
  - `accessToken`, `refreshToken` y `expiresAt`, **cifrados en BD** (AES-256-GCM con `TOKEN_ENCRYPTION_KEY`)
  - `scopes`, `product` (`premium` | `free` | `open`), `checkedAt`
  - Sustituye a `User.googleId` (migrar el dato).
- [ ] **Vincular Google:** `POST /users/me/accounts/google` con ID token (requiere sesión).
- [ ] **Vincular Spotify:** `POST /users/me/accounts/spotify` con `code` + `code_verifier` (PKCE); el backend lo canjea y guarda los tokens cifrados.
- [ ] **Desvincular:** `DELETE /users/me/accounts/:provider`. Si es tu único método de entrada (no tienes contraseña), se rechaza.
- [ ] **Errores:** si esa cuenta de Spotify o de Google ya está vinculada a **otro** usuario de EchoMusic, error claro; nunca se mueve sola.
- [ ] **Scopes de Spotify, pedidos todos de una vez:**
  - `user-read-email` y `user-read-private` (para saber si es Premium)
  - `user-read-playback-state`, `user-modify-playback-state` y `user-read-currently-playing`
- [ ] **Comprobar Premium:**
  - leer `product` de `GET https://api.spotify.com/v1/me` al vincular
  - repetirlo si `checkedAt` tiene más de 24 h, y siempre antes de crear un evento
- [ ] **Renovar el token:** si Spotify responde `invalid_grant` (el usuario revocó el acceso), marcar la cuenta como desconectada y avisar en la app.
- [ ] **`GET /users/me`** devuelve `accounts: { google: {...} | null, spotify: { displayName, premium, connected } | null }` y `hasPassword`.
- [ ] **Poner contraseña:** si entraste con Google o Spotify, "Crear contraseña" (`POST /users/me/password` sin pedir la actual).

### 3.2 App — sección "Cuentas conectadas" en el perfil

- [ ] **Tarjeta Spotify:**
  - sin conectar: botón verde "Conectar Spotify"
  - conectada: nombre + insignia **Premium** o **Free** + "Desconectar"
  - si es Free: aviso "Necesitas Premium para crear eventos; puedes unirte y votar igualmente"
- [ ] **Tarjeta Google:** igual, sin la parte de Premium.
- [ ] **Bloque "Método de acceso":** "Email y contraseña" o "Crear contraseña".

### 3.3 Integración con eventos (junto con el compañero)

- [ ] **Al pulsar "Crear evento" sin Spotify Premium:** hoja inferior "Conecta tu Spotify Premium para crear eventos" con botón que lanza la vinculación y vuelve al formulario. Tú haces la hoja y la vinculación; él la llama.
- [ ] **El backend rechaza `POST /events`** con un error tipado (`SPOTIFY_PREMIUM_REQUIRED`) si el dueño no tiene Premium vinculado. La app nunca decide (V.3).

**Hecho cuando:** un usuario registrado con email puede conectar Spotify desde el perfil, ve si es Premium, puede desconectarlo, y el compañero puede pedir el token del dueño del evento.

---

## Fase 4 — Login / registro con Spotify 🟢

**Opinión: buena idea, pero después de las fases 2 y 3.** No es obligatoria (el subject pide Facebook **o** Google), pero encaja con la app: casi todo el que la use tiene Spotify, y quien entra con Spotify Premium puede crear eventos sin pasos extra. Además, con la Fase 3 hecha cuesta poco, porque reutiliza todo el flujo OAuth.

- [ ] **`POST /auth/spotify`** (con `code` + `code_verifier`):
  - si `providerUserId` existe, entra
  - si no, crea la cuenta y lleva al onboarding de nombre de usuario
- [ ] ⚠️ **Seguridad:** Spotify **no garantiza** que el email esté verificado.
  - **No** vincular automáticamente por email con una cuenta existente (riesgo de robo de cuenta).
  - Si el email ya existe: "Ya tienes cuenta con este email. Entra con tu contraseña y conecta Spotify desde el perfil".
  - Documentarlo en `security.md`; es un buen punto para la defensa.
- [ ] **Botón "Continuar con Spotify"** en la bienvenida, siguiendo las guías de marca de Spotify.

---

## Fase 5 — Perfil completo 🔴🟢

- [ ] 🔴 **Pantalla "Perfil de otro usuario"** (`GET /users/:id` ya existe): se abre al tocar a un amigo o un resultado del buscador. Sin ella no se puede **demostrar** que la información "solo amigos" y la "privada" se respetan.
- [ ] 🔴 **Dejar claros los tres niveles en la UI.** Propuesta:
  - **Público:** @usuario, nombre, avatar
  - **Amigos / público / privado** (eliges): bio, ciudad, gustos musicales
  - **Privado** (solo tú): email, fecha de nacimiento, cuentas conectadas
- [ ] 🔴 **Botón "Ver como lo ven otros"**: vista previa como desconocido y como amigo. Muy útil en la defensa.
- [ ] 🟢 **Visibilidad:** selector segmentado con texto ("Público · Amigos · Solo yo") en vez de emojis que rotan.
- [ ] 🟢 **Géneros musicales:** chips seleccionables de una lista fija en vez de texto libre.
- [ ] 🟢 **Avatar:** foto con `expo-image-picker` y subida al backend, o iniciales con color si no hay foto.
- [ ] 🟢 **Separar "Mi perfil" (vista) de "Editar perfil"** (formulario), con guardado que avise si sales con cambios sin guardar.
- [ ] 🟢 **Eliminar cuenta**: confirmación escribiendo tu @usuario; borra datos y revoca los tokens de Spotify y Google.
- [ ] 🟢 **Cambiar email** con verificación por código al email nuevo.

---

## Fase 6 — Navegación y experiencia 🟢

Propuestas para que sea más cómoda, intuitiva y atractiva, ordenadas por impacto/esfuerzo:

**Entrada a la app**
- [ ] **Pantalla de bienvenida** (sustituye al login como primera pantalla):
  - logo y lema
  - "Continuar con Spotify", "Continuar con Google", "Registrarme con email"
  - "Ya tengo cuenta"
  - icono ⚙️ con la URL del backend
- [ ] **Splash screen** con `expo-splash-screen`, en vez de un spinner en negro.
- [x] **`app.json`:** nombre `EchoMusic`, paquete `com.echomusic.app`, esquema `echomusic://`.
- [ ] **`app.json`:** icono propio y `userInterfaceStyle: "dark"` (la UI ya es oscura).
- [ ] **Onboarding tras registrarse**, 3 pasos que se pueden saltar: nombre de usuario y foto → gustos musicales → conectar Spotify.

**Formularios**
- [ ] **Errores bajo cada campo**, en vez de una única línea roja abajo.
- [ ] **Contraseña:** botón 👁 para mostrarla e indicador de fortaleza.
- [ ] **Nombre de usuario:** comprobación de disponibilidad mientras escribes (`GET /auth/username-available?u=`).
- [ ] **Código de 6 dígitos:** se envía solo al completar los 6; cuenta atrás de 60 s en "Reenviar código"; botón "Abrir Gmail".
- [ ] **Login:** recordar el último email usado.

**Sensación general**
- [ ] **`theme.ts` con colores, espaciados y tipografías comunes.** Hoy cada pantalla repite `#121212`, `#1db954`… Compartirlo con el compañero.
- [ ] **Toasts** para confirmaciones ("Perfil guardado") en vez de `Alert`.
- [ ] **Vibración ligera** (`expo-haptics`) al votar, guardar o aceptar amigos.
- [ ] **Skeletons** mientras carga y *pull to refresh* en listas.
- [ ] 🟢 **Desbloqueo con Face ID / huella** (`expo-local-authentication`) al reabrir la app.

**Amigos**
- [ ] **Badge en la pestaña Amigos** con las solicitudes pendientes.
- [ ] **Tocar un amigo abre su perfil** (Fase 5).
- [ ] 🟢 **Añadir amigo por QR**: tu QR en el perfil y un escáner en Amigos (`echomusic://u/<username>`).

---

## Fase 7 — Calidad, documentación y defensa 🔴

- [ ] 🔴 **Tests de backend** de todo lo de auth y usuarios: OAuth con Google y Spotify simulados, vincular y desvincular, rate limit, logout, cambio de contraseña, visibilidad de perfil.
- [ ] 🔴 **Tests de la app** (al menos stores y utilidades: `auth.ts`, `emailCheck.ts`) con Jest. "Tests por cada capa" (V.8).
- [ ] 🔴 **Swagger** de los endpoints de `auth` y `users`, con entradas y salidas (V.4). El setup en `main.ts` es común; acordarlo.
- [ ] 🔴 **`docs/security.md` actualizado:**
  - OAuth con `state`
  - tickets de un solo uso
  - tokens de terceros cifrados
  - códigos HMAC con límite de intentos
  - por qué no se vincula por email con Spotify
  - rate limiting real
- [ ] 🔴 **ADR 005 — Autenticación social:** opción A frente a B, con justificación.
- [ ] 🔴 **Documentar qué partes de esta zona se hicieron con IA** y saber explicarlas (Cap. II).
- [ ] 🔴 **Guion de demo para la defensa:**
  1. registro → código → onboarding
  2. login con Google
  3. conectar Spotify → Premium
  4. perfil visto como amigo y como desconocido
  5. recuperar contraseña
  6. URL del backend
  7. logs en BD
- [ ] Marcar en `music_room_checklist.md` los puntos cerrados.

---

## Contrato con eventos (para acordar con el compañero)

Lo que **yo** expongo y **él** usa en vez de la cuenta global de `.env`:

```ts
// backend/src/users/spotify-accounts.service.ts
getAccessToken(userId: string): Promise<string>   // token válido (renueva si hace falta) o lanza SpotifyNotLinkedError
isPremium(userId: string): Promise<boolean>       // vuelve a comprobarlo si checkedAt tiene más de 24 h
```

**Lo que hace él:**
- `SpotifyService` recibe el `userId` del dueño del evento en lugar de leer `SPOTIFY_REFRESH_TOKEN`.
- `POST /events` comprueba `isPremium(ownerId)`; si no, devuelve `403 SPOTIFY_PREMIUM_REQUIRED`.
- Si se implementa *Music Control Delegation*, el dispositivo y la cuenta que suenan siguen siendo los del dueño. Lo que se delega es el permiso de control, no la cuenta.

**Lo que hago yo:** la pantalla y la hoja "Conecta Spotify Premium" que su pantalla abre cuando recibe ese error.

---

## Orden recomendado

Se sigue desarrollando con **Expo Go** (más cómodo). La app Android propia se compila **justo antes de probar Google y Spotify**, que son lo único que Expo Go no puede ejecutar. No se deja para el final, para descubrir con margen cualquier problema nativo.

1. ✅ **Fase 1:** obligatorios rápidos.
2. **Fase 0:** consolas ✅ Google Cloud (cliente Web), ⬜ Spotify Dashboard.
3. **En Expo Go:**
   - **Fase 5:** puntos 🔴 del perfil (ver el perfil de otro usuario, tres niveles claros).
   - **Fases 2 y 3, parte de backend:** endurecer `POST /auth/google`, `LinkedAccount`, tokens cifrados, Premium. Se comprueban con tests.
4. **Migración a app Android:** Android Studio + emulador, `expo-dev-client`, primera compilación, cliente Android de Google con SHA-1.
5. **Fases 2 y 3, parte de app:** botón de Google nativo y conectar Spotify, probados en el emulador. Esto desbloquea al compañero.
6. **Fase 7:** docs, tests y Swagger de lo hecho.
7. Con lo obligatorio cerrado: **Fase 4** (login con Spotify), **Fase 6** y el resto de la 5.
