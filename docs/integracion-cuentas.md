# Integración — Cambios de la parte de cuentas que afectan al resto

Resumen para juntar el código el lunes 2026-10-05. Cubre todo lo hecho desde el commit `b1f0b07` en la parte de cuentas (login, registro, sesiones, perfil).
Detalle de cada cambio: [diario de defensa](defensa/diario.md) · plan: [roadmap](roadmap-cuentas-usuario.md).

## 1. Al hacer pull: qué hay que hacer en cada PC

1. **`make install`:**
   - añade al `backend/.env` las variables nuevas
   - sustituye el `JWT_SECRET` de ejemplo por uno aleatorio
   - genera `TOKEN_ENCRYPTION_KEY`
2. **Rellenar a mano en `backend/.env`** (pedírselo a hcarrasc42; nunca por git):
   - `SMTP_USER=musicroomurduliz42@gmail.com` y `SMTP_PASS=<contraseña de aplicación>`. Si se dejan como en el ejemplo, todo funciona y los códigos salen por la terminal del backend.
   - `GOOGLE_CLIENT_ID=<ID del cliente Web de Google Cloud>`
3. **Instalar la dependencia nueva de la app** (`expo-constants`): `cd mobile && npm install`.
4. **Arrancar el backend:** al arrancar, TypeORM crea solo las columnas y tablas nuevas.

## 2. Cambios en el backend que afectan a todo

| Cambio | Efecto para eventos/cola/reproductor |
|---|---|
| **Rate limiting global** (`HttpThrottlerGuard`, 120 peticiones/min por IP; solo HTTP) | El sondeo del reproductor cada 2 s (30/min) cabe de sobra. Si algún endpoint necesita más, usar `@Throttle(...)` o `@SkipThrottle()` en él. El WebSocket **no** está limitado |
| **Logs globales** (`LoggingInterceptor` como `APP_INTERCEPTOR`) | Cada petición HTTP de cualquier controlador se guarda en `action_logs`. No hay que hacer nada |
| **`JwtStrategy` consulta la BD** en cada petición (cuenta existe + sesión no revocada) | `req.user` sigue siendo `{ id, email }`. Una petición más por llamada (lectura por clave primaria) |
| **Mensajes de error en español** en auth | La app no compara mensajes de eventos, así que no afecta |
| **`app.module.ts`** | Añadidos `LogsModule` y el `APP_GUARD`. **Posible conflicto** si el compañero añadió módulos: hay que quedarse con los dos |

## 3. Endpoints de auth que cambiaron

| Antes | Ahora |
|---|---|
| `GET /auth/verify-email?token=` | `POST /auth/verify-email` `{ email, code }` → devuelve la sesión (`access_token`, `refresh_token`) |
| `POST /auth/reset-password` `{ token, password }` | `{ email, code, password }` |
| — | `POST /auth/resend-verification` `{ email }` |
| — | `POST /auth/logout` `{ refresh_token }` |
| — | `POST /auth/logout-all` (con sesión) |
| — | `POST /auth/change-password` `{ currentPassword?, newPassword }` (con sesión) → nueva sesión |
| `POST /auth/login`, `/refresh`, `/forgot-password` | Igual, pero responden **200** en vez de 201 |
| `GET /users/me` | Añade `hasPassword` |

## 4. Cambios en la app que afectan a todo

| Archivo | Cambio | Ojo al fusionar |
|---|---|---|
| `mobile/src/api/client.ts` | `deviceHeaders()` exportada (plataforma, modelo, versión real); errores de validación unidos en un texto | Si el compañero tocó `apiFetch`, mantener `deviceHeaders()` |
| `mobile/src/state/auth.ts` | Reescrito: `verifyEmail`, `changePassword`, `logout` (revoca en servidor), `logoutAll` | Usar `useAuth().logout()` para cerrar sesión, no borrar AsyncStorage a mano |
| `mobile/src/navigation/index.tsx` | `Settings` también en `AuthStack`; `ChangePassword` en `ProfileStack` | **Posible conflicto** si se añadieron pantallas de eventos: quedarse con ambas |
| `mobile/src/screens/profile/SettingsScreen.tsx` | Reescrita (probar conexión, cuenta) | — |
| `mobile/app.json` | Nombre **EchoMusic**, `slug: echomusic`, `scheme: echomusic`, `android.package: com.echomusic.app` | No volver a `mobile`/`musicroom` |
| `mobile/package.json` | Añadido `expo-constants` | Conflicto típico en `package-lock.json`: aceptar ambos y repetir `npm install` |

## 5. Decisiones que afectan a eventos (para hablar el lunes)

1. **Spotify por usuario** ([ADR 005](adr/005-autenticacion-social.md), roadmap Fase 3):
   - Cada usuario conecta **su** Spotify Premium desde el perfil.
   - Contrato propuesto: la parte de cuentas expone `getAccessToken(userId)` e `isPremium(userId)`.
   - Eventos deja de usar `SPOTIFY_REFRESH_TOKEN` del `.env`, usa la cuenta del **dueño del evento**, y `POST /events` exige Premium (`403 SPOTIFY_PREMIUM_REQUIRED`).
2. **App Android propia para la entrega:** se sigue desarrollando en Expo Go. Antes de probar Google y Spotify se compila con `expo-dev-client`. El paquete es `com.echomusic.app`.
3. **Limitación de Spotify:** en *Development mode* solo pueden conectar Spotify las cuentas añadidas en *User Management* del Dashboard.
4. **Forma de trabajar** a partir de ahora, para no volver al caos:
   - una rama por tarea (`cuentas/...`, `eventos/...`)
   - *pull request* a `main` revisada por el otro
   - `git pull` antes de empezar cada día
