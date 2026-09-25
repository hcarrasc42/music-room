# MusicRoom — Diseño completo (mínimo viable)

**Fecha:** 2026-09-17
**Servicios:** Track Vote + Control Delegation
**Stack:** NestJS / PostgreSQL / React Native (Android) / Spotify Web API

---

## 1. Mapa de módulos

```
backend/src/
├── auth/          JWT + Google OAuth + verificación email + reset password
├── users/         perfil con 4 niveles de visibilidad + sistema de amigos
├── events/        Track Vote: crear evento, visibilidad, licencias, invitar
├── queue/         sugerencias + votos + ordenación + polling Spotify
├── spotify/       búsqueda + comandos de reproducción (servicio compartido)
├── delegation/    dispositivos por usuario + delegar control de reproducción
├── gateway/       WebSocket Socket.IO — actualizaciones en tiempo real
└── common/        LoggingInterceptor + ActionLog (ya existe)
```

**Pantallas mobile (Android):**
Login → Registro → Lista eventos → Detalle evento (cola + voto) → Crear evento → Amigos → Delegación → Settings (URL backend)

---

## 2. Auth

### Flujo email/contraseña
1. `POST /auth/register` → hash bcrypt, guarda usuario sin verificar, envía email con token
2. `GET /auth/verify-email?token=...` → activa la cuenta
3. `POST /auth/login` → devuelve `access_token` (JWT 15 min) + `refresh_token` (rotatorio)
4. `POST /auth/refresh` → rota refresh token, devuelve nuevo par
5. `POST /auth/forgot-password` → envía email con token de reset (1h de vida)
6. `POST /auth/reset-password` → valida token, actualiza hash

### Flujo Google OAuth
1. App abre OAuth con Expo AuthSession → obtiene `id_token` de Google
2. `POST /auth/google` con el `id_token` → backend verifica con Google, crea o recupera usuario
3. Devuelve mismo par JWT que el flujo email

### Tablas
```sql
users(id, email, password_hash, google_id, is_verified, created_at)
refresh_tokens(id, user_id, token_hash, expires_at, revoked_at)
email_verifications(id, user_id, token_hash, expires_at, type)
-- type: 'verify' | 'reset'
```

### Notas
- Refresh token rotatorio: si llega uno ya usado → se revocan todos los de ese usuario
- Email: Nodemailer + SMTP (Gmail app password en .env)
- Sin 2FA, sin sesiones web

---

## 3. Perfil de usuario + Amigos

### Perfil
```sql
user_profiles(
  user_id,
  display_name, avatar_url,          -- siempre público
  bio_visibility,                     -- 'public'|'friends'|'private'
  bio, city,
  music_visibility,                   -- 'public'|'friends'|'private'
  music_genres, favorite_artists
)
```

### Sistema de amigos (mínimo)
```sql
friendships(user_id, friend_id, status, created_at)
-- status: 'pending' | 'accepted'
-- UNIQUE(user_id, friend_id)
```

### Endpoints
```
GET  /users/me                  → perfil completo propio
PUT  /users/me                  → actualizar perfil + visibilidades
GET  /users/:id                 → perfil filtrado por visibilidad
GET  /users/search?q=email      → buscar usuario por email

POST   /friends                 → enviar solicitud de amistad
GET    /friends                 → amigos aceptados
GET    /friends/requests        → solicitudes pendientes recibidas
PUT    /friends/:id/accept      → aceptar solicitud
DELETE /friends/:id             → rechazar o eliminar amigo
```

---

## 4. Track Vote

### Concepto
Un usuario crea un evento. Los asistentes sugieren canciones de Spotify y votan. La canción con más votos sube en la cola y se reproduce antes. El backend encadena canciones automáticamente mediante polling a Spotify cada 3 segundos.

### Tablas
```sql
events(
  id, owner_id, name, is_public,
  license,        -- 'open' | 'invited' | 'geo'
  lat, lng, radius_m, time_start, time_end,
  is_active, created_at
)
event_invites(event_id, user_id)

suggestions(
  id, event_id, spotify_track_id,
  track_name, artist, album_art,
  status,         -- 'queued' | 'playing' | 'played'
  suggested_by, created_at
)
votes(id, suggestion_id, user_id, created_at)
-- UNIQUE(suggestion_id, user_id) → resuelve concurrencia a nivel de motor
```

### Endpoints REST
```
POST   /events                      → crear evento
GET    /events                      → listar eventos públicos
GET    /events/:id                  → detalle + cola ordenada por votos
PUT    /events/:id                  → editar (solo owner)
DELETE /events/:id                  → cerrar evento

POST   /events/:id/invites          → invitar usuario (solo owner)
POST   /events/:id/suggestions      → sugerir canción
GET    /events/:id/suggestions      → cola actual

POST   /suggestions/:id/vote        → votar (máx 1 por usuario)
DELETE /suggestions/:id/vote        → quitar voto
```

### Licencias
- `open` → cualquier usuario autenticado puede votar
- `invited` → solo usuarios en `event_invites`
- `geo` → el cliente manda headers `x-lat` y `x-lng`; el backend comprueba distancia ≤ `radius_m` al punto del evento y hora dentro de `time_start`–`time_end`

### WebSocket (Socket.IO)
```
cliente: join room "event:{id}"
servidor emite:
  "queue:updated"  → cola reordenada completa
  "track:playing"  → { trackId, trackName, artist, albumArt }
```

### Polling Spotify
- Un `setInterval` de 3s por evento activo (`is_active = true`)
- Condición de cambio: `progress_ms / duration_ms > 0.95`
- Acción: marca suggestion actual como `played`, extrae la más votada con status `queued`, la marca `playing`, llama a `PUT /v1/me/player/play`, emite `track:playing` por WebSocket
- Si no hay más canciones en cola: pausa reproducción, emite evento de cola vacía

---

## 5. Control Delegation

### Concepto
Un usuario registra sus dispositivos. Puede ceder el control de reproducción de Spotify a cualquier otro usuario (buscado por email o desde lista de amigos). El delegado controla la reproducción usando las credenciales Spotify del propietario — el delegado nunca ve esas credenciales.

### Tablas
```sql
devices(id, user_id, name, created_at)

delegations(id, device_id, owner_id, delegate_id, is_active, created_at)
-- Solo una delegación activa por dispositivo a la vez
```

### Endpoints REST
```
GET    /devices                         → mis dispositivos
POST   /devices                         → registrar dispositivo { name }
DELETE /devices/:id                     → eliminar dispositivo

POST   /devices/:id/delegate            → delegar { delegateEmail }
DELETE /devices/:id/delegate            → revocar delegación activa
GET    /devices/:id/delegate            → ver delegación activa

GET    /delegation/received             → delegaciones activas que he recibido
POST   /delegation/:id/play             → reproducir
POST   /delegation/:id/pause            → pausar
POST   /delegation/:id/next             → siguiente canción
POST   /delegation/:id/volume           → ajustar volumen { percent }
```

### Seguridad
Cada acción de control verifica `delegation.delegate_id === req.user.id` y `delegation.is_active`. El backend ejecuta la llamada a Spotify con el refresh token del `owner_id`.

---

## 6. Módulo Spotify

Servicio interno compartido por `queue/` y `delegation/`. No tiene endpoints REST propios.

```typescript
search(query: string): Promise<Track[]>          // GET /v1/search, límite 10
play(trackUri: string): Promise<void>            // PUT /v1/me/player/play
pause(): Promise<void>                           // PUT /v1/me/player/pause
next(): Promise<void>                            // POST /v1/me/player/next
setVolume(percent: number): Promise<void>        // PUT /v1/me/player/volume
getPlayer(): Promise<PlayerState>               // GET /v1/me/player
```

Acepta 200 y 204 como respuesta exitosa (comportamiento real de la API en 2026).

---

## 7. Seguridad

- **Rate limiting:** `@nestjs/throttler` — máx 10 req/min en `/auth/login` y `/auth/register`
- **JWT Guard:** todos los endpoints privados requieren `Authorization: Bearer <token>`
- **Autorización por recurso:** `owner_id === req.user.id` en eventos, dispositivos y delegaciones
- **Logs:** `LoggingInterceptor` ya existente guarda plataforma (`x-platform`), dispositivo (`x-device`) y versión de app (`x-app-version`) en cada request
- **Credenciales:** todo en `.env`, nunca en git

---

## 8. API docs y CI

- **Swagger:** `@nestjs/swagger` en `GET /api` (solo en modo dev)
- **Tests:** un test de integración por módulo (usando `@nestjs/testing` + Vitest)
- **CI:** GitHub Actions — instala dependencias, corre tests, lint
- **Ramp-up:** k6 (`docs/load/vote-scenario.js` ya existe como placeholder)

---

## 9. Orden de implementación

1. Auth (login + Google + email verification)
2. Users + Amigos
3. Spotify module
4. Events + Queue + WebSocket (Track Vote completo)
5. Devices + Delegation (Control Delegation completo)
6. Mobile: pantallas en el mismo orden
7. Swagger + tests por módulo + CI
8. Ramp-up con k6
