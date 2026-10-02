# Diario de desarrollo — Cuentas y usuario

Registro de cada cambio de la parte de cuentas (responsable: hcarrasc42) pensado para preparar la defensa: qué se hizo, por qué, qué alternativas había, cómo demostrarlo y qué preguntas puede hacer el evaluador.

Cada entrada indica también **cómo se usó la IA** (Cap. II del subject: transparencia y saber defender cada decisión).

Índice:
1. [Revisión del estado del proyecto](#1-revisión-del-estado-del-proyecto--2026-10-02)
2. [Códigos de 6 dígitos y envío real de emails](#2-códigos-de-6-dígitos-y-envío-real-de-emails--2026-10-02)
3. [Fase 1 — Sesiones seguras, fuerza bruta, logs y ajustes](#3-fase-1--sesiones-seguras-fuerza-bruta-logs-y-ajustes--2026-10-02)
4. [Fase 0 — App Android propia y preparación del login social](#4-fase-0--app-android-propia-y-preparación-del-login-social--2026-10-02)

---

## 1. Revisión del estado del proyecto — 2026-10-02

**Qué:** se revisó todo el código (backend y app) contra el subject y se rellenó `music_room_checklist.md` con el estado real de cada requisito. A partir de ahí se escribió `docs/roadmap-cuentas-usuario.md` con el plan por fases de esta parte.

**Hallazgos importantes:**
- Login con Google programado pero nunca configurado.
- Spotify con una sola cuenta global para todos los eventos.
- Logs y rate limiting programados pero sin activar.

**Uso de IA:** revisión hecha con Claude (Claude Code) leyendo el código; conclusiones revisadas y priorizadas por el equipo.

---

## 2. Códigos de 6 dígitos y envío real de emails — 2026-10-02

**Qué:**
- La verificación de cuenta y la recuperación de contraseña pasan de un token de 64 caracteres (o un enlace a `localhost` que no abría nada desde el móvil) a un **código de 6 dígitos** por email.
- Los correos se envían de verdad por **Gmail SMTP** desde `musicroomurduliz42@gmail.com`, con una contraseña de aplicación.

**Por qué:** V.1 exige validación por email y recuperación de contraseña. El token largo no se podía escribir a mano y el enlace apuntaba a `localhost`, así que en la práctica no funcionaba.

**Cómo funciona:**
- **Generación:** `crypto.randomInt` genera el código; se guarda como **HMAC-SHA256(userId:código)** con un secreto del servidor, nunca en claro.
- **Caducidad:** 15 minutos.
- **Intentos:** máximo 5 fallos; después el código se borra y hay que pedir otro.
- **Reenvío:** un código por minuto como mucho; pedir uno nuevo anula el anterior.
- **Comprobación:** el código se valida **junto con el email** (no sirve el de otra cuenta), con comparación en tiempo constante (`timingSafeEqual`).
- **Tras verificar:** el backend devuelve la sesión y el usuario entra directamente.

**Alternativas descartadas:**
- **Enlace mágico en el email:** necesita *deep links* y un dominio público; no funcionaba con `localhost`.
- **Token largo:** seguro, pero inusable a mano.

**Cómo demostrarlo:**
1. Registrarse y enseñar el correo con el código en el asunto.
2. Introducirlo y entrar directamente.
3. Hacer "¿Olvidaste tu contraseña?" → código → contraseña nueva.

**Preguntas probables:**
- *"Un código de 6 dígitos son solo un millón de combinaciones, ¿no se puede adivinar?"*
  - Con 5 intentos por código, un atacante tiene 5 entre 1.000.000 de acertar por código.
  - Cada nuevo código exige esperar un minuto, y además hay límite por IP (5 peticiones por minuto).
  - Para un millón de intentos necesitaría unos 200.000 minutos (más de 4 meses) contra una sola cuenta, con el dueño recibiendo emails.
- *"¿Por qué HMAC y no SHA-256 simple?"* Con SHA-256 simple, quien robara la base de datos podría calcular el hash de los 1.000.000 de códigos en milisegundos. Con HMAC necesita también el secreto del servidor.
- *"¿Por qué el mismo mensaje exista o no el email?"* Para no revelar qué emails tienen cuenta (enumeración de cuentas).

**Uso de IA:** diseñado e implementado con Claude; probado por el equipo con Gmail real (llegó el código y funcionó el cambio de contraseña). 7 tests unitarios en `auth.service.spec.ts`.

---

## 3. Fase 1 — Sesiones seguras, fuerza bruta, logs y ajustes — 2026-10-02

**Qué y por qué:**

| Cambio | Requisito |
|---|---|
| ⚙️ Ajustes accesibles desde el login, con "Probar conexión" | V.5: URL del backend configurable (antes solo después de entrar) |
| Cambiar contraseña estando dentro (o crearla si la cuenta es de Google) | V.1: cambio de contraseña |
| Logout que revoca la sesión en el servidor | V.6: robo de sesión |
| "Cerrar sesión en todos los dispositivos" | V.6: robo de sesión / móvil perdido |
| Rate limiting por IP + bloqueo de cuenta tras 5 fallos | V.6: fuerza bruta contra la API |
| "Cuenta sin verificar" solo con la contraseña correcta | V.6: enumeración de cuentas |
| `make install` genera un `JWT_SECRET` aleatorio | V.6: el secreto de ejemplo estaba en el repo |
| Logs de cada petición con plataforma, modelo y versión | V.6: "toda acción genera log" |

**Cómo funciona:**
- **Rate limiting:** `HttpThrottlerGuard` global con 120 peticiones por minuto y por IP. El login tiene 10 por minuto, y registro, códigos y cambio de contraseña 5 por minuto. Solo se aplica a HTTP: aplicado al WebSocket rompía la entrada a la sala de eventos (fallo encontrado en la prueba en vivo y corregido).
- **Bloqueo de cuenta:**
  - `failedLoginAttempts` y `lockedUntil` en `users`
  - 5 fallos seguidos → 15 minutos bloqueada
  - un login correcto o recuperar la contraseña lo reinicia
- **Revocación de sesiones:**
  - `logout` marca como revocado el refresh token de ese dispositivo
  - `logout-all`, cambio de contraseña y reset revocan todos los refresh tokens y fijan `sessionsValidAfter`
  - `JwtStrategy` rechaza cualquier access token emitido antes de esa fecha (actualización en el ADR 004)
- **Logs:** `LoggingInterceptor` global (`APP_INTERCEPTOR`) guarda en `action_logs`:
  - usuario, acción (`POST /suggestions/:id/vote`) y código de respuesta
  - plataforma, modelo y versión de la app
  - IP

  La app manda las cabeceras `x-platform`, `x-device` y `x-app-version` en todas las peticiones, también en login y refresh.

**Alternativas descartadas:**
- **Lista negra de access tokens:** habría que guardar cada token revocado. Una fecha por usuario es más simple y basta.
- **Bloqueo permanente tras N fallos:** permitiría a un atacante bloquear cuentas ajenas a voluntad. 15 minutos limita el daño y la recuperación por email lo desbloquea.

**Cómo demostrarlo:**
1. ⚙️ en el login → "Probar conexión".
2. Fallar 5 veces → mensaje de bloqueo, incluso con la contraseña correcta (probado).
3. Repetir 11 veces un login desde la terminal → error 429.
4. Consultar la base de datos:
   ```sql
   select action, status_code, platform, device_model, app_version from action_logs order by created_at desc limit 10;
   ```
5. Cambiar la contraseña y ver que la otra sesión (emulador o curl) recibe 401.

**Preguntas probables:**
- *"¿Qué pasa si roban el access token?"* Vale como mucho 15 minutos. Con "cerrar sesión en todos los dispositivos" o cambiando la contraseña se corta al momento.
- *"¿Y si roban el refresh token?"* Es rotatorio y se guarda hasheado. Si alguien reutiliza uno ya usado, se revocan todos los del usuario (detección de robo).
- *"¿El bloqueo no permite bloquear cuentas ajenas?"* Sí, durante 15 minutos; es un compromiso aceptado y documentado. El dueño puede desbloquearla al momento recuperando la contraseña.
- *"¿Se loguean las acciones por WebSocket?"* Todavía no; pendiente y anotado en la checklist.

**Uso de IA:** implementado con Claude; probado por el equipo (bloqueo y "Probar conexión" comprobados en el iPhone; 429, logs y WebSocket comprobados en vivo). 6 tests nuevos (45 en total).

---

## 4. Fase 0 — App Android propia y preparación del login social — 2026-10-02

**Qué:**
- **Decisión de arquitectura** del login social y de Spotify por usuario ([ADR 005](../adr/005-autenticacion-social.md)): **app Android propia** compilada con `expo-dev-client` en vez de Expo Go.
  - **Google:** Google Sign-In nativo (ID token verificado en el backend).
  - **Spotify:** PKCE con vuelta a `echomusic://spotify-auth`.
- **`app.json`:** nombre `EchoMusic` y paquete Android `com.echomusic.app`.
- **`.gitignore`:** `android/` e `ios/` excluidas; son carpetas generadas.
- **`TOKEN_ENCRYPTION_KEY`** en `.env`, para cifrar los tokens de Spotify de cada usuario. `make install` la genera y añade a un `.env` existente las variables nuevas que falten.
- **Guía paso a paso** `docs/guia-android-google-spotify.md`: Android Studio en D:, emulador, SHA-1, Google Cloud y Spotify Dashboard.

**Por qué:**
- **Login social:** es obligatorio (V.1/V.5) y debe estar **en la app móvil**.
- **Plataforma:** el subject deja elegir Android o iOS (IV.2), y la corrección será en Android.
- **Expo Go:** no admite SDKs nativos ni esquema propio, así que una app propia es la forma correcta de tener Google Sign-In y la vuelta de Spotify.

**Cómo cambió la decisión** (útil para V.8, "cuestionar las propias decisiones"):
1. La primera propuesta fue **OAuth desde el backend con un túnel HTTPS (ngrok)**, para poder seguir con Expo Go en un iPhone sin Mac. Se llegó a integrar en `make dev`.
2. Al revisarlo con el compañero salieron dos datos nuevos: la corrección será en **Android** y Expo Go no conviene para la entrega.
3. Con esas restricciones la opción nativa es más simple: sin servicio externo, sin dominio público y con el selector de cuentas nativo. Se cambió **antes de escribir código de OAuth** y se retiró la integración del túnel.

**Alternativas descartadas:**
- **Túnel + OAuth en el backend:** depende de ngrok levantado y de Expo Go.
- **`expo-auth-session` en Expo Go:** sin dirección de vuelta fija y con tokens de Spotify en el móvil.

**Cómo demostrarlo** (cuando esté la Fase 2): app **EchoMusic** instalada en el emulador → "Continuar con Google" → selector de cuentas nativo → dentro.

**Preguntas probables:**
- *"¿Cómo sabe el backend que el token de Google es legítimo?"*
  - Verifica la **firma** con las claves públicas de Google.
  - Comprueba que la **audiencia** es nuestro cliente (un token emitido para otra app se rechaza) y que no ha caducado.
  - Solo enlaza con una cuenta existente si Google marca el email como **verificado**.
- *"¿Para qué sirve el cliente Android si no se usa su ID en el código?"* Google solo entrega tokens a una app cuyo **paquete y certificado (SHA-1)** coincidan con un cliente registrado. Otra app que se haga pasar por la nuestra no puede pedirlos.
- *"¿Por qué no subís la carpeta `android/`?"* Es código generado por `expo prebuild` a partir de `app.json`, no escrito por nosotros (IV.1). Se regenera al compilar.
- *"¿Por qué PKCE con Spotify si el backend tiene el secreto?"* PKCE garantiza que el `code` interceptado en el móvil no sirve sin el `code_verifier`, que solo conoce quien inició el login. Es la práctica recomendada para apps móviles.
- *"¿Por qué cifrar los tokens de Spotify?"* Dan acceso a la cuenta de Spotify del usuario. Si se filtra la base de datos no sirven sin la clave, que solo está en el `.env` del servidor.

**Pendiente del equipo:**
- instalar Android Studio y crear el emulador
- primera compilación (juntos)
- Google Cloud y Spotify Dashboard siguiendo la guía

**Uso de IA:**
- La primera propuesta (túnel) la hizo Claude con la suposición equivocada de que se probaría en iPhone.
- La corrección vino del equipo: el compañero propuso Google Cloud nativo y se confirmó Android leyendo el subject.
- Claude reescribió el ADR, la guía y el roadmap, revisados por el equipo.
