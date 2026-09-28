# Music Room — Mobile App Design Spec

**Date:** 2026-09-28  
**Scope:** React Native (Expo) mobile app — full implementation from skeleton to functional app  
**Backend:** NestJS REST API + Socket.IO already built at `backend/`

---

## 1. Overview

The mobile app is a "remote control" for the Music Room backend. Zero business logic lives in the client — every action calls the backend and the backend is the single source of truth. The app covers all mandatory requirements of section V of the subject: auth (V.1), Track Vote service (V.2.1), mobile application (V.5), and security logging (V.6).

---

## 2. Technology choices

| Concern | Choice | Reason |
|---|---|---|
| State management | Zustand (already installed) | No new deps, easy to defend |
| HTTP client | `fetch` nativo | No new deps, sufficient for this use case |
| Navigation | React Navigation v7 (already installed) | Already in package.json |
| Persistence | AsyncStorage (already installed) | Token + settings storage |
| Real-time | socket.io-client (already installed) | Matches backend Socket.IO v4 |
| Google OAuth | `expo-auth-session` + `expo-web-browser` | Standard Expo OAuth flow |

New dependencies to install: `expo-auth-session`, `expo-web-browser`, `expo-device` (for device model header).

---

## 3. File structure

```
mobile/src/
├── api/
│   └── client.ts              # fetch wrapper — auth headers, 401 refresh, retry
├── state/
│   ├── auth.ts                # Zustand: tokens, user, hydrate/login/logout
│   └── settings.ts            # Zustand: backendUrl (persisted)
├── navigation/
│   └── index.tsx              # RootNavigator: AuthStack | MainTabs
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── ForgotPasswordScreen.tsx
│   │   └── VerifyEmailScreen.tsx
│   ├── events/
│   │   ├── EventsListScreen.tsx
│   │   └── EventDetailScreen.tsx
│   ├── search/
│   │   └── SearchEventsScreen.tsx
│   ├── friends/
│   │   └── FriendsScreen.tsx
│   └── profile/
│       ├── ProfileScreen.tsx
│       └── SettingsScreen.tsx
└── components/
    ├── TrackRow.tsx
    ├── SuggestModal.tsx
    └── NowPlayingBar.tsx
```

---

## 4. Navigation tree

```
RootNavigator
├── AuthStack             (shown when auth.token is null)
│   ├── LoginScreen       (default)
│   ├── RegisterScreen
│   ├── ForgotPasswordScreen
│   └── VerifyEmailScreen
└── MainTabs              (shown when auth.token exists)
    ├── Tab "Eventos"
    │   └── NativeStack: EventsListScreen → EventDetailScreen
    ├── Tab "Buscar"
    │   └── SearchEventsScreen
    ├── Tab "Amigos"
    │   └── FriendsScreen
    └── Tab "Perfil"
        └── NativeStack: ProfileScreen → SettingsScreen
```

`RootNavigator` reads `auth.token` from the Zustand store. When `hydrate()` is still running, it shows a loading spinner. Once resolved, it renders AuthStack or MainTabs.

---

## 5. State stores

### `state/auth.ts`

```ts
interface AuthState {
  token: string | null
  refreshToken: string | null
  user: { id: string; email: string; displayName: string } | null
  hydrate: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  loginGoogle: (idToken: string) => Promise<void>
  logout: () => Promise<void>
  _setTokens: (token: string, refreshToken: string, user: object) => Promise<void>
}
```

- `hydrate()`: reads token + refreshToken from AsyncStorage. If token present, calls `GET /users/me` to validate. If 401, calls `POST /auth/refresh`. If refresh fails, clears storage and stays in AuthStack.
- `login()`: calls `POST /auth/login`, stores tokens + user.
- `loginGoogle()`: calls `POST /auth/google` with `{ idToken }`, stores tokens + user.
- `logout()`: clears AsyncStorage, resets state to null.

### `state/settings.ts`

```ts
interface SettingsState {
  backendUrl: string   // default: "http://localhost:3000"
  setBackendUrl: (url: string) => Promise<void>
}
```

Persisted in AsyncStorage under key `settings.backendUrl`. Read on app start.

---

## 6. API client (`api/client.ts`)

Exports one function:

```ts
apiFetch(path: string, options?: RequestInit & { lat?: number; lng?: number }): Promise<any>
```

Behavior:
1. Reads `backendUrl` from settings store and `token` from auth store.
2. Builds full URL: `${backendUrl}${path}`.
3. Sets headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer ${token}`
   - `x-platform: android | ios | web` (via `Platform.OS`)
   - `x-device: <Device.modelName>` (via `expo-device`)
   - `x-app-version: 1.0.0`
   - `x-lat` / `x-lng` if provided (for geo-license voting)
4. On **401 response**: calls `POST /auth/refresh` with the stored refreshToken, updates tokens in auth store, retries the original request once.
5. On second 401 (refresh failed): calls `auth.logout()` and throws.
6. Returns parsed JSON on success, throws `{ status, message }` on error.

---

## 7. Screens

### 7.1 LoginScreen

- Email input + password input.
- "Iniciar sesión" button → calls `auth.login()`.
- "Continuar con Google" button → triggers `expo-auth-session` Google OAuth flow, gets `id_token`, calls `auth.loginGoogle(idToken)`.
- Link "¿Olvidaste tu contraseña?" → navigates to ForgotPasswordScreen.
- Link "¿No tienes cuenta? Regístrate" → navigates to RegisterScreen.
- Error messages shown inline below the form.

### 7.2 RegisterScreen

- displayName + email + password inputs.
- "Crear cuenta" button → calls `POST /auth/register`.
- On success → navigates to VerifyEmailScreen.
- Link "¿Ya tienes cuenta? Inicia sesión" → back to LoginScreen.

### 7.3 ForgotPasswordScreen

- Email input.
- "Enviar enlace" → calls `POST /auth/forgot-password`.
- Shows confirmation message on success.

### 7.4 VerifyEmailScreen

- Static screen: "Revisa tu email y haz clic en el enlace de verificación."
- "Ya lo verifiqué" button → tries `auth.login()` with stored credentials; if still unverified, shows error.
- Note: backend has no resend-verification endpoint — no resend button.

### 7.5 EventsListScreen

- Calls `GET /events` (returns all public active events).
- Displays two sections: "Mis eventos" (filtered client-side where `event.ownerId === user.id`) and "Eventos públicos" (the rest).
- "+" FAB → modal to create a new event (name, isPublic toggle, license selector: open/invited/geo).
- Tap event → navigates to EventDetailScreen with the event id.
- Pull-to-refresh.

### 7.6 EventDetailScreen

Props: `eventId`

Layout (top to bottom):
1. **NowPlayingBar** — green bar showing current track name + artist. Hidden if nothing is playing.
2. **Track list** — ordered by vote count descending. Each row is a `TrackRow`.
3. **FAB "+ Sugerir"** — opens `SuggestModal`.

Socket.IO lifecycle:
- On mount: connect to `backendUrl` with `{ auth: { token } }`, emit `join` with `{ eventId }`.
- Listen `queue:updated` → refetch `GET /events/:id/suggestions`.
- Listen `track:playing` → update NowPlayingBar state.
- On unmount: emit `leave` with `{ eventId }`, disconnect.

### 7.7 SearchEventsScreen

- Text input for event name search.
- Calls `GET /events` once on mount and caches the result. Filters client-side by name as the user types (debounced 300ms). No search query param exists in the backend.
- Results list: event name, public badge.
- Tap → navigates to EventDetailScreen.

### 7.8 FriendsScreen

Three sections:
1. **Solicitudes pendientes** — `GET /friends/requests` → buttons Accept / Reject per request.
2. **Mis amigos** — `GET /friends` list.
3. **Buscar usuario** — email input → `GET /users/search?q=email` → "Añadir amigo" button → `POST /friends`.

### 7.9 ProfileScreen

- Shows own profile (`GET /users/me`).
- Editable fields: displayName, bio, city, musicGenres, favoriteArtists.
- Visibility selectors (public / friends / private) for bio and music preferences.
- "Guardar" button → `PUT /users/me`.
- "Ajustes" link → navigates to SettingsScreen.

### 7.10 SettingsScreen

- **URL del backend** — text input pre-filled with current `settings.backendUrl`. "Guardar" button → `settings.setBackendUrl()`. Allows testers to point to any server.
- **Cerrar sesión** button → `auth.logout()`.

---

## 8. Components

### TrackRow

Props: `{ trackName, artist, albumArt, voteCount, userVoted, onVote, onUnvote }`

- Album art thumbnail (28×28).
- Track name + artist.
- Vote button: shows count. Green if `userVoted`, grey otherwise.
- Tap vote button → calls `POST /suggestions/:id/vote` or `DELETE /suggestions/:id/vote`.

### NowPlayingBar

Props: `{ trackName, artist } | null`

- Full-width green bar.
- Hidden when null.
- Shows ▶ icon + track name + artist.

### SuggestModal

- React Native `Modal` component (fullscreen, presented modally).
- Text input → calls `GET /spotify/search?q=<query>` (debounced 300ms).
- Results list: track name, artist, album art.
- Tap result → calls `POST /events/:id/suggestions` → closes modal + emits socket refresh.

---

## 9. Security headers

Every request from `apiFetch` includes:
- `x-platform`: `Platform.OS` (`android` / `ios` / `web`)
- `x-device`: `Device.modelName` from `expo-device`
- `x-app-version`: hardcoded `"1.0.0"` (matches `app.json` version)

These feed the backend's `ActionLog` entity for audit logging (requirement V.6).

---

## 10. Backend URL configurability

`SettingsScreen` exposes a plain text input for the backend URL, saved to AsyncStorage and read by `apiFetch` on every call. This satisfies requirement V.5: *"la dirección del back-end es configurable desde la app para pruebas."*

Default value: `http://localhost:3000` (overridden to actual server IP during evaluation).

---

## 11. Out of scope

- Offline mode (bonus, not mandatory)
- Push notifications
- Music Control Delegation UI (separate feature, not yet implemented in backend)
- Playlist Editor UI (separate feature, not yet implemented in backend)
- Facebook OAuth (only Google implemented in backend)
