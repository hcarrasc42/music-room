# Music Room — Checklist de requisitos (subject v6)

Lista de verificación antes de entregar y defender el proyecto.
Marca cada punto solo si puedes **demostrarlo funcionando** y **justificarlo** en la defensa.

> Última revisión del código: 2026-10-02 (commit `b1f0b07`).
> Leyenda: `[x]` hecho · `[ ]` pendiente · ⚠️ nota sobre algo parcial o un fallo detectado.

---

## 0. Puntos que pueden hacerte fallar directamente

- [x] Ninguna credencial, API key o variable de entorno está subida a git (todo en `.env`, `.env` en `.gitignore`).
  - Solo se versiona `.env.example` con valores de ejemplo; ningún `.env` real en el historial.
- [x] No hay librerías de terceros commiteadas en el repo (solo código propio).
- [x] Las dependencias se descargan solas desde un clone limpio (Makefile o mecanismo equivalente).
  - `make install` → `scripts/setup.js` (npm install + crea `backend/.env`). ⚠️ Sin probar aún desde un clone limpio.
- [ ] La parte obligatoria está **completa y sin fallos** (si no, el bonus ni se evalúa).
- [ ] Todo el trabajo está dentro del repo Git y los nombres de carpetas/ficheros son correctos.
  - ⚠️ Revisar si deben quedarse en la raíz `get-spotify-token.js`, `test-spotify.js` y `.superpowers/` (brainstorm).
- [x] El SDK elegido **no hace el trabajo por ti** (la lógica de voto/playlist/delegación es tuya).
  - Spotify solo reproduce; la cola, los votos y el orden se calculan en nuestro backend.

---

## 1. Uso de IA (Capítulo II)

- [ ] Podéis explicar y defender **cada** decisión técnica sin depender de la IA.
- [ ] Está documentado de forma transparente qué partes se generaron con IA.
  - ⚠️ No existe ningún documento sobre uso de IA (ni README).
- [ ] Todo lo generado por IA ha sido revisado por el equipo (no hay arquitectura "caja negra").

---

## 2. Arquitectura general (Capítulo IV)

- [ ] Elección de tecnología de back-end justificada (ventajas/inconvenientes evaluados).
  - ⚠️ Hay ADRs de SDK, tiempo real, BD y sesión, pero ninguno justifica NestJS/Node frente a alternativas.
- [x] Elección de almacenamiento de datos justificada. (`docs/adr/003-database.md`, PostgreSQL)
- [x] Aplicación móvil para **Android o iOS** (tecnología libre). (React Native + Expo)
- [ ] La app cubre **todas** las acciones necesarias del proyecto.
  - ⚠️ Faltan en la app: invitar a un evento, elegir licencia (`invited`/`geo`) al crear evento, enviar ubicación al votar.

---

## 3. Usuario (V.1)

- [x] Registro en el primer arranque: mail/contraseña **o** red social (Facebook o Google).
- [ ] Un usuario ya registrado puede **vincular** su cuenta de red social (Facebook o Google).
  - ⚠️ Solo vinculación implícita: si haces login con Google con el mismo email, se asocia `googleId`. No hay opción "Vincular Google" en el perfil.
- [x] Si el registro fue con mail/contraseña: **validación por email** obligatoria. (el login se bloquea si no está verificado)
- [x] Recuperación / cambio de contraseña si el usuario la olvida. (forgot + reset con código)
- [x] Perfil: el usuario puede **consultar y actualizar**:
  - [x] información pública,
  - [x] información visible solo para amigos,
  - [x] información privada,
  - [x] preferencias musicales.
  - Implementado con selector de visibilidad (público / amigos / privado) para bio+ciudad y para gustos musicales.

---

## 4. Servicios (V.2)

> El subject se contradice: el Cap. III dice "los siguientes servicios deberán implementarse" (los 3) y V.2 dice "al menos 2 de 3"; V.7 vuelve a hablar de "tus 3 servicios". **Confirma con el equipo/evaluador**; lo seguro es implementar los 3.

- [ ] El usuario accede al menos a **2** de: Music Track Vote, Music Playlist Editor, Music Control Delegation.
  - ⚠️ Solo está Music Track Vote.

### 4.1 Music Track Vote (V.2.1)

- [x] Cualquiera puede **sugerir** una pista para la playlist actual.
  - ⚠️ `suggest` y `getSuggestions` no comprueban si el evento es privado ni la licencia.
- [x] Cualquiera puede **votar** la siguiente pista.
- [x] Las pistas con más votos **suben** en la lista y se reproducen antes. (orden por `COUNT(votes)` en SQL)
- [ ] Visibilidad:
  - [x] Por defecto el evento es **público**.
  - [x] Público → cualquier usuario encuentra el evento y vota.
  - [ ] Privado → solo los invitados encuentran el evento y votan.
    - ⚠️ `GET /events` solo lista públicos, así que un invitado **no ve** el evento privado en la app.
    - ⚠️ Un evento privado con licencia `open` deja votar a cualquiera que conozca el id de la sugerencia.
- [ ] Licencias:
  - [x] Por defecto, **todo el mundo puede votar**.
  - [ ] Licencia: solo los invitados pueden votar.
    - Backend hecho (`canVote` + `POST /events/:id/invites`), pero la app no permite elegir esa licencia ni invitar.
  - [ ] Licencia: solo quien esté en **una ubicación concreta** dentro de **una franja horaria** concreta (ej. 16:00–18:00) puede votar.
    - Backend hecho (haversine + franja), pero la app no envía `x-lat`/`x-lng`. ⚠️ La franja usa la hora local del servidor y no soporta franjas que crucen medianoche.
- [x] Gestión de **concurrencia**: varios usuarios votando a la vez, la misma pista o distintas, sin corromper el orden.
  - UNIQUE (suggestionId, userId) en BD + recuento en SQL.
  - ⚠️ Tiempo real roto: votar/sugerir no emite `queue:updated`, y la app envía `join` con `{ eventId }` mientras el gateway espera un string → los clientes no entran en la sala.

### 4.2 Music Control Delegation (V.2.2)

- [ ] Gestión de licencias **por dispositivo** asociado a la cuenta del usuario.
- [ ] El usuario puede **delegar el control de la música** a distintos amigos.
  - Sin implementar (ahora solo el dueño del evento controla la reproducción).

### 4.3 Music Playlist Editor (V.2.3)

- [ ] Edición de playlists **multi-usuario en tiempo real**.
- [ ] Visibilidad:
  - [ ] Por defecto la playlist es **pública**.
  - [ ] Pública → todos los usuarios acceden.
  - [ ] Privada → solo los invitados acceden.
- [ ] Licencias:
  - [ ] Por defecto, todos pueden editar.
  - [ ] Licencia: solo los invitados pueden editar.
- [ ] Gestión de **concurrencia**: varios usuarios moviendo pistas a la vez (mismas o distintas).
  - Sin implementar.

---

## 5. Servidor (V.3)

- [x] **Todos** los datos de los servicios se guardan en el back-end. (PostgreSQL)
- [x] El back-end es la única fuente de verdad (el cliente no decide nada).

---

## 6. API (V.4)

- [ ] Documentación de referencia de la API con **métodos, entradas y salidas** (ej. Swagger).
  - ⚠️ `@nestjs/swagger` está instalado pero no configurado en `main.ts`.
- [x] API basada en REST (o alternativa) — **justificable** y sabes explicar sus características.
- [x] Formato de intercambio JSON (o alternativa) — **justificable**.

---

## 7. Aplicación móvil (V.5)

- [x] La app es solo un "mando a distancia" del back-end (cero lógica de negocio en el cliente).
- [x] La **dirección del back-end es configurable** desde la app para pruebas. (⚙️ en el login o Perfil → Ajustes, con "Probar conexión")
- [x] Autenticación vía red social (Facebook o Google) implementada en la app.
  - Requiere `EXPO_PUBLIC_GOOGLE_CLIENT_ID`; sin él, el botón no aparece.

---

## 8. Seguridad (V.6)

- [ ] Un usuario autenticado accede a **sus** datos y **no** a los de otros (probado).
  - ⚠️ `/spotify/play|pause|next|previous|seek` solo piden JWT: cualquier usuario controla el Spotify del servidor.
  - ⚠️ `GET /events/:id/player` y las sugerencias no comprueban acceso a eventos privados.
- [x] Mecanismos de protección implementados (bruteforce de la API, robo de sesión, etc.).
  - Hecho: bcrypt, refresh token rotatorio y hasheado, detección de reutilización, ValidationPipe con whitelist.
  - Rate limiting por IP (`HttpThrottlerGuard`) + bloqueo de cuenta tras 5 fallos + logout real en servidor.
- [x] Otros riesgos **identificados y documentados** con las protecciones practicables. (`docs/security.md`)
- [ ] **Toda** acción de la app genera log en el back-end, incluyendo:
  - [x] plataforma (Android, iOS…),
  - [x] dispositivo (modelo),
  - [x] versión de la aplicación.
  - Cada petición HTTP queda en `action_logs`. ⚠️ Faltan las acciones por WebSocket y las peticiones rechazadas antes de llegar al controlador (401 del guard, 429).

---

## 9. Ramp-up / carga (V.7)

- [ ] Medición real de carga hecha (AB, Gatling, Siege, Tsung, JMeter…).
  - ⚠️ `make load` apunta a `docs/load/vote-scenario.js`, que no existe.
- [ ] Número de usuarios simultáneos soportados por cada servicio **medido y justificado**.
- [ ] Características del servidor especificadas (CPU, RAM, cloud o on-premise).
- [ ] La cifra máxima es **coherente** con la plataforma (decenas en Raspberry, miles en servidor).

---

## 10. Agilidad, calidad e integración continua (V.8)

- [ ] Reparto de tareas entre los miembros del equipo demostrable.
- [ ] Tests específicos por **cada capa** del proyecto.
  - Backend: 32 tests unitarios (vitest) pasando + 1 e2e. Móvil: ningún test.
- [ ] Capacidad de cuestionar y justificar vuestras propias decisiones.
- [ ] Integración continua en marcha. (no hay `.github/workflows` ni otro CI)

---

## 11. Bonus (solo si lo obligatorio es PERFECTO)

- [ ] **Multi-plataforma**: versión web responsive adaptable a cualquier pantalla.
- [ ] **IoT**: mecanismo tipo iBeacon (info del evento al acercarse a un evento público).
- [ ] **Suscripción gratuita vs. de pago**: cambio entre ofertas y funcionalidades restringidas a pago (ej. Music Playlist Editor).
- [ ] **Modo offline**: uso sin conexión + sincronización posterior, gestionando:
  - [ ] conflictos y concurrencia,
  - [ ] datos obsoletos en el móvil.

---

## 12. Entrega (Capítulo VII)

- [ ] Todo subido al repositorio Git.
- [ ] Nombres de carpetas y ficheros verificados.
- [ ] Probado desde un **clone limpio** en otra máquina antes de la defensa.
