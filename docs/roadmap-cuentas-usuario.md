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
| Login con Google | ❌ El código existe, pero **nunca se ha configurado** (sin `GOOGLE_CLIENT_ID` ni en backend ni en la app) y en Expo Go no funciona tal cual |
| Vincular red social desde el perfil | ❌ No existe |
| Spotify por usuario | ❌ Hoy hay **una sola cuenta de Spotify global** en `.env` (`SPOTIFY_REFRESH_TOKEN`) que usan todos los eventos |
| URL del backend configurable | ✅ Desde el login (⚙️) y desde el perfil, con "Probar conexión" |
| Cerrar sesión | ✅ Revoca la sesión en el servidor; también "en todos los dispositivos" |
| Rate limiting en login/códigos | ✅ Por IP y bloqueo por cuenta |

---

## Decisión previa: cómo hacer OAuth (Google y Spotify) con Expo Go

**El problema.** El móvil habla con el backend por la IP de la wifi (`http://192.168.x.x:3000`). Ni Google ni Spotify aceptan esa dirección como *redirect URI*:
- **Google:** solo acepta `https` con dominio público, o `localhost`.
- **Spotify:** desde 2025 exige `https`; la única excepción es `http://127.0.0.1`. Además, los redirect URIs de Expo Go (`exp://192.168.x.x:8081`) cambian con cada red.

**Opciones:**

| | A. OAuth desde el backend + túnel HTTPS (**recomendada**) | B. Build de desarrollo con SDKs nativos |
|---|---|---|
| Cómo | La app abre el navegador en `https://<túnel>/auth/google/start`; el backend habla con Google/Spotify, guarda los tokens y devuelve a la app un código de un solo uso | `expo-dev-client` + `@react-native-google-signin` + esquema propio `musicroom://` |
| ¿Sirve en Expo Go? | Sí | No, hay que compilar la app |
| iPhone | Funciona sin cuenta de Apple Developer | Instalar en un iPhone físico necesita Mac + Xcode o cuenta de pago (99 $/año) |
| Secretos | Todos en el backend (client secret de Spotify incluido) | Igual para Spotify |
| Mismo mecanismo para Google y Spotify | Sí (un único flujo) | No (Google nativo, Spotify por navegador) |
| Pega | Hay que tener el túnel levantado (ngrok, dominio estático gratis). En el plan gratuito, ngrok muestra una página de aviso la primera vez | Más configuración nativa; cada cambio nativo obliga a recompilar |

**Recomendación: A.** Funciona con lo que ya usáis (Expo Go en iPhone) y resuelve Google y Spotify con el mismo código. Además, la URL del túnel sirve como URL del backend desde cualquier red, en la defensa incluida.

Flujo A, paso a paso:
1. La app llama a `WebBrowser.openAuthSessionAsync(${backend}/auth/{google|spotify}/start?mode=login|link&redirect=<Linking.createURL('auth')>)`.
2. El backend genera un `state` aleatorio, guardado 10 min, con modo, usuario (si es `link`) y la URL de vuelta validada. Después redirige a Google o Spotify.
3. Google o Spotify vuelven a `https://<túnel>/auth/{google|spotify}/callback?code&state`.
4. El backend canjea el `code`, obtiene el perfil y crea, inicia sesión o vincula la cuenta. Después redirige a la app con `?ticket=<un solo uso, 60 s>`.
5. La app canjea el ticket en `POST /auth/exchange` y recibe `access_token` y `refresh_token` (en modo `link`, solo un OK).

---

## Fase 0 — Preparación (sin código)

- [ ] **Túnel HTTPS:** cuenta en ngrok, reservar el dominio estático gratuito y añadir `make tunnel` (o integrarlo en `make dev`).
- [ ] **Google Cloud Console:**
  - crear el proyecto y la pantalla de consentimiento (modo *Testing*, con los emails de los dos como usuarios de prueba)
  - crear el cliente OAuth tipo *Web* con redirect `https://<túnel>/auth/google/callback`
- [ ] **Spotify Developer Dashboard:**
  - añadir el redirect `https://<túnel>/auth/spotify/callback`
  - añadir en *User Management* las cuentas de Spotify que vayan a probar. En modo desarrollo solo pueden entrar los usuarios añadidos a mano y el cupo es pequeño; comprobad el límite actual.
- [ ] **`.env.example`:** añadir `PUBLIC_URL`, `GOOGLE_CLIENT_SECRET` y `TOKEN_ENCRYPTION_KEY`, con instrucciones.
- [ ] **Contrato con el compañero:** acordar el contrato Spotify ↔ eventos (ver la sección *Contrato con eventos* al final).

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

- [ ] **Backend:**
  - `GET /auth/google/start`, `GET /auth/google/callback` y `POST /auth/exchange` (flujo A)
  - comprobar `email_verified` del perfil de Google: solo con email verificado se vincula a una cuenta existente con el mismo email
- [ ] **Usuario nuevo con Google:** se crea la cuenta y pasa a una pantalla corta de onboarding para elegir **nombre de usuario** (hoy recibe `usuario_123456` y no se entera).
- [ ] **Si el email ya existe con contraseña:** se vincula y entra. El aviso "Hemos conectado Google a tu cuenta" sale una sola vez.
- [ ] **App:** botón "Continuar con Google" (con el logo oficial y siguiendo las guías de marca de Google) en la bienvenida y en el login.
- [ ] Quitar el flujo antiguo de `expo-auth-session/providers/google` y `POST /auth/google` con `idToken`, o dejarlo solo si se elige la opción B.
- [ ] **Tests:** usuario nuevo, email existente verificado, email no verificado y `state` inválido o caducado.

**Hecho cuando:** desde Expo Go en el iPhone se puede crear cuenta con Google y volver a entrar con Google.

---

## Fase 3 — Cuentas conectadas (Spotify y Google desde el perfil) 🔴🟡

Cubre "un usuario registrado puede **vincular** su cuenta de red social" (V.1, 🔴) y lo que necesita tu compañero: **crear un evento requiere Spotify Premium** (🟡).

### 3.1 Backend

- [ ] **Entidad `LinkedAccount`:**
  - `userId`, `provider` (`google` | `spotify`), `providerUserId` (único por proveedor), `email`, `displayName`
  - `accessToken`, `refreshToken` y `expiresAt`, **cifrados en BD** (AES-256-GCM con `TOKEN_ENCRYPTION_KEY`)
  - `scopes`, `product` (`premium` | `free` | `open`), `checkedAt`
  - Sustituye a `User.googleId` (migrar el dato).
- [ ] **Vincular:** `GET /auth/{provider}/start?mode=link` (requiere sesión; el `state` guarda el `userId`).
- [ ] **Desvincular:** `DELETE /users/me/accounts/:provider`. Si es tu único método de entrada (no tienes contraseña), se rechaza.
- [ ] **Errores:** si esa cuenta de Spotify o de Google ya está vinculada a **otro** usuario de MusicRoom, error claro; nunca se mueve sola.
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

- [ ] **`GET /auth/spotify/start?mode=login`:**
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
- [ ] **`app.json`:** nombre `MusicRoom` (hoy es `mobile`), icono propio y `userInterfaceStyle: "dark"` (la UI ya es oscura).
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
- [ ] 🟢 **Añadir amigo por QR**: tu QR en el perfil y un escáner en Amigos (`musicroom://u/<username>`).

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

1. **Fase 1:** obligatorios rápidos, sin dependencias.
2. **Fase 0:** túnel y consolas, en paralelo con la 1.
3. **Fase 2:** Google, que es obligatorio.
4. **Fase 3:** cuentas conectadas y Spotify Premium; desbloquea al compañero.
5. **Fase 5:** solo los puntos 🔴 del perfil.
6. **Fase 7:** docs, tests y Swagger de lo hecho hasta aquí.
7. Con lo obligatorio cerrado: **Fase 4** (Spotify login), **Fase 6** y el resto de la 5.
