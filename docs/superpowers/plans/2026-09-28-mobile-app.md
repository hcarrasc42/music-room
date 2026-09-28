# Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional React Native (Expo) mobile app for Music Room that covers auth, Track Vote, and all mandatory 42 subject requirements.

**Architecture:** Zero business logic in the client — every action calls the NestJS backend and the server is the single source of truth. Zustand stores hold auth tokens and settings, a single `apiFetch` wrapper adds security headers and handles token refresh, and Socket.IO connects per event for real-time queue updates.

**Tech Stack:** Expo SDK 57, React Native 0.86, React Navigation v7 (native-stack + bottom-tabs), Zustand v5, AsyncStorage, socket.io-client v4, expo-auth-session, expo-web-browser, expo-device.

---

## Backend API reference (verified from source)

| Method | Path | Body / Query | Response |
|---|---|---|---|
| POST | /auth/register | `{ email, password }` | `{ message }` |
| POST | /auth/login | `{ email, password }` | `{ access_token, refresh_token }` |
| POST | /auth/refresh | `{ refresh_token }` | `{ access_token, refresh_token }` |
| POST | /auth/google | `{ idToken }` | `{ access_token, refresh_token }` |
| POST | /auth/forgot-password | `{ email }` | `{ message }` |
| GET | /users/me | — | `{ id, email, displayName, bio, city, bioVisibility, musicGenres, favoriteArtists, musicVisibility }` |
| PUT | /users/me | `{ displayName?, bio?, city?, bioVisibility?, musicGenres?, favoriteArtists?, musicVisibility? }` | profile |
| GET | /users/search?q= | — | `[{ id, email }]` |
| GET | /events | — | `[{ id, ownerId, name, isPublic, license, isActive, createdAt }]` |
| POST | /events | `{ name, isPublic?, license? }` | event |
| GET | /events/:id/suggestions | — | `[{ id, trackName, artist, albumArt, spotifyTrackId, spotifyUri, status, suggestedById, votes, userVoted }]` |
| POST | /events/:id/suggestions | `{ spotifyTrackId, spotifyUri, trackName, artist, albumArt? }` | suggestion |
| POST | /suggestions/:id/vote | headers: x-lat, x-lng | vote |
| DELETE | /suggestions/:id/vote | — | `{ message }` |
| GET | /spotify/search?q= | — | Spotify tracks array |
| GET | /friends | — | `[{ id, userId, friendId, status }]` |
| GET | /friends/requests | — | pending requests |
| POST | /friends | `{ email }` | friendship |
| PUT | /friends/:id/accept | — | friendship |
| DELETE | /friends/:id | — | `{ message }` |

**Notes:**
- After login/google, call `GET /users/me` to get user data — auth endpoints do not return user info.
- `votes` in suggestions is a raw SQL string (e.g. `"3"`), cast with `Number()`.
- `userVoted` is a boolean from a raw EXISTS subquery.

---

## Task 1: Install new dependencies

**Files:**
- Modify: `mobile/package.json`

- [ ] **Step 1: Install expo-auth-session, expo-web-browser, expo-device**

```bash
cd mobile
npx expo install expo-auth-session expo-web-browser expo-device expo-crypto
```

Expected output: packages added to package.json, no errors.

- [ ] **Step 2: Verify installation**

```bash
node -e "require('./node_modules/expo-device/build/Device')" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd ..
git add mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): install expo-auth-session, expo-web-browser, expo-device"
```

---

## Task 2: Settings store

**Files:**
- Create: `mobile/src/state/settings.ts`

- [ ] **Step 1: Create the file**

```typescript
// mobile/src/state/settings.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'settings.backendUrl';
const DEFAULT_URL = 'http://localhost:3000';

interface SettingsState {
  backendUrl: string;
  hydrated: boolean;
  hydrateSettings: () => Promise<void>;
  setBackendUrl: (url: string) => Promise<void>;
}

export const useSettings = create<SettingsState>((set) => ({
  backendUrl: DEFAULT_URL,
  hydrated: false,

  hydrateSettings: async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    set({ backendUrl: stored ?? DEFAULT_URL, hydrated: true });
  },

  setBackendUrl: async (url: string) => {
    await AsyncStorage.setItem(STORAGE_KEY, url);
    set({ backendUrl: url });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/state/settings.ts
git commit -m "feat(mobile): add settings store with persisted backendUrl"
```

---

## Task 3: Auth store

**Files:**
- Create: `mobile/src/state/auth.ts`

- [ ] **Step 1: Create the file**

```typescript
// mobile/src/state/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { useSettings } from './settings';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hydrating: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  _setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
}

async function fetchMe(baseUrl: string, token: string): Promise<AuthUser> {
  const res = await fetch(`${baseUrl}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  hydrating: true,

  hydrate: async () => {
    await useSettings.getState().hydrateSettings();
    const token = await AsyncStorage.getItem('auth.token');
    const refreshToken = await AsyncStorage.getItem('auth.refreshToken');

    if (!token) {
      set({ hydrating: false });
      return;
    }

    const baseUrl = useSettings.getState().backendUrl;

    // Validate token
    try {
      const user = await fetchMe(baseUrl, token);
      set({ token, refreshToken, user, hydrating: false });
      return;
    } catch {
      // Token may be expired — try refresh
    }

    if (!refreshToken) {
      await AsyncStorage.multiRemove(['auth.token', 'auth.refreshToken']);
      set({ hydrating: false });
      return;
    }

    try {
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      await get()._setTokens(data.access_token, data.refresh_token);
      const user = await fetchMe(baseUrl, data.access_token);
      set({ user, hydrating: false });
    } catch {
      await AsyncStorage.multiRemove(['auth.token', 'auth.refreshToken']);
      set({ token: null, refreshToken: null, user: null, hydrating: false });
    }
  },

  login: async (email: string, password: string) => {
    const baseUrl = useSettings.getState().backendUrl;
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? 'Login failed');
    await get()._setTokens(data.access_token, data.refresh_token);
    const user = await fetchMe(baseUrl, data.access_token);
    set({ user });
  },

  loginGoogle: async (idToken: string) => {
    const baseUrl = useSettings.getState().backendUrl;
    const res = await fetch(`${baseUrl}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? 'Google login failed');
    await get()._setTokens(data.access_token, data.refresh_token);
    const user = await fetchMe(baseUrl, data.access_token);
    set({ user });
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['auth.token', 'auth.refreshToken']);
    set({ token: null, refreshToken: null, user: null });
  },

  _setTokens: async (accessToken: string, newRefreshToken: string) => {
    await AsyncStorage.setItem('auth.token', accessToken);
    await AsyncStorage.setItem('auth.refreshToken', newRefreshToken);
    set({ token: accessToken, refreshToken: newRefreshToken });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/state/auth.ts
git commit -m "feat(mobile): add auth store with hydrate, login, loginGoogle, logout"
```

---

## Task 4: API client

**Files:**
- Create: `mobile/src/api/client.ts`

- [ ] **Step 1: Create the file**

```typescript
// mobile/src/api/client.ts
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { useAuth } from '../state/auth';
import { useSettings } from '../state/settings';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { lat?: number; lng?: number } = {},
): Promise<T> {
  const { lat, lng, ...fetchOptions } = options;
  const baseUrl = useSettings.getState().backendUrl;
  const token = useAuth.getState().token;
  const refreshToken = useAuth.getState().refreshToken;

  const buildHeaders = (t: string | null): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-platform': Platform.OS,
      'x-device': Device.modelName ?? 'unknown',
      'x-app-version': '1.0.0',
    };
    if (t) headers['Authorization'] = `Bearer ${t}`;
    if (lat !== undefined) headers['x-lat'] = String(lat);
    if (lng !== undefined) headers['x-lng'] = String(lng);
    return headers;
  };

  const doFetch = async (t: string | null) =>
    fetch(`${baseUrl}${path}`, {
      ...fetchOptions,
      headers: { ...buildHeaders(t), ...(fetchOptions.headers as Record<string, string> ?? {}) },
    });

  let res = await doFetch(token);

  if (res.status === 401 && refreshToken) {
    // Try refresh
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      await useAuth.getState()._setTokens(data.access_token, data.refresh_token);
      res = await doFetch(data.access_token);
    } else {
      await useAuth.getState().logout();
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!res.ok) {
    let message = 'Request failed';
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch { /* empty */ }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/api/client.ts
git commit -m "feat(mobile): add apiFetch with JWT auth headers, 401 refresh, security headers"
```

---

## Task 5: Navigation

**Files:**
- Create: `mobile/src/navigation/index.tsx`

- [ ] **Step 1: Create the navigation file**

```tsx
// mobile/src/navigation/index.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../state/auth';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';

import EventsListScreen from '../screens/events/EventsListScreen';
import EventDetailScreen from '../screens/events/EventDetailScreen';
import SearchEventsScreen from '../screens/search/SearchEventsScreen';
import FriendsScreen from '../screens/friends/FriendsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';

export type AuthStackParams = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyEmail: { email: string; password: string };
};

export type EventsStackParams = {
  EventsList: undefined;
  EventDetail: { eventId: string; eventName: string };
};

export type SearchStackParams = {
  SearchEvents: undefined;
  EventDetail: { eventId: string; eventName: string };
};

export type ProfileStackParams = {
  Profile: undefined;
  Settings: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const EventsStack = createNativeStackNavigator<EventsStackParams>();
const SearchStack = createNativeStackNavigator<SearchStackParams>();
const ProfileStack = createNativeStackNavigator<ProfileStackParams>();
const Tabs = createBottomTabNavigator();

function EventsNavigator() {
  return (
    <EventsStack.Navigator>
      <EventsStack.Screen name="EventsList" component={EventsListScreen} options={{ title: 'Eventos' }} />
      <EventsStack.Screen name="EventDetail" component={EventDetailScreen} options={({ route }) => ({ title: route.params.eventName })} />
    </EventsStack.Navigator>
  );
}

function SearchNavigator() {
  return (
    <SearchStack.Navigator>
      <SearchStack.Screen name="SearchEvents" component={SearchEventsScreen} options={{ title: 'Buscar' }} />
      <SearchStack.Screen name="EventDetail" component={EventDetailScreen} options={({ route }) => ({ title: route.params.eventName })} />
    </SearchStack.Navigator>
  );
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Eventos" component={EventsNavigator} />
      <Tabs.Screen name="Buscar" component={SearchNavigator} />
      <Tabs.Screen name="Amigos" component={FriendsScreen} />
      <Tabs.Screen name="Perfil" component={ProfileNavigator} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const { token, hydrating } = useAuth();

  if (hydrating) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1db954" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {token ? (
        <MainTabs />
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
          <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/navigation/index.tsx
git commit -m "feat(mobile): add navigation — AuthStack and MainTabs with 4 tabs"
```

---

## Task 6: Auth screens

**Files:**
- Create: `mobile/src/screens/auth/LoginScreen.tsx`
- Create: `mobile/src/screens/auth/RegisterScreen.tsx`
- Create: `mobile/src/screens/auth/ForgotPasswordScreen.tsx`
- Create: `mobile/src/screens/auth/VerifyEmailScreen.tsx`

- [ ] **Step 1: Create LoginScreen**

```tsx
// mobile/src/screens/auth/LoginScreen.tsx
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { AuthStackParams } from '../../navigation';

WebBrowser.maybeCompleteAuthSession();

// Replace with your Google OAuth Web Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

type Props = NativeStackScreenProps<AuthStackParams, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginGoogle } = useAuth();

  const [, response, promptAsync] = Google.useAuthRequest({ webClientId: GOOGLE_CLIENT_ID });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token;
      if (idToken) handleGoogleToken(idToken);
    }
  }, [response]);

  const handleGoogleToken = async (idToken: string) => {
    setLoading(true);
    setError('');
    try {
      await loginGoogle(idToken);
    } catch (e: any) {
      setError(e.message ?? 'Error con Google');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError('Completa todos los campos'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.message ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>🎵 Music Room</Text>
      <Text style={s.subtitle}>Music, Collaboration & Mobility</Text>

      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#888"
        value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={s.input} placeholder="Contraseña" placeholderTextColor="#888"
        value={password} onChangeText={setPassword} secureTextEntry />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Iniciar sesión</Text>}
      </TouchableOpacity>

      <Text style={s.divider}>— o continuar con —</Text>

      <TouchableOpacity style={s.googleBtn} onPress={() => promptAsync()} disabled={loading || !GOOGLE_CLIENT_ID}>
        <Text style={s.googleText}>G  Continuar con Google</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={s.link}>¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={s.link}>¿No tienes cuenta? Regístrate</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  divider: { color: '#555', textAlign: 'center', marginVertical: 16 },
  googleBtn: { backgroundColor: '#fff', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 16 },
  googleText: { color: '#333', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1db954', textAlign: 'center', marginTop: 12, fontSize: 14 },
  error: { color: '#e74c3c', textAlign: 'center', marginBottom: 8 },
});
```

- [ ] **Step 2: Create RegisterScreen**

```tsx
// mobile/src/screens/auth/RegisterScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';
import { AuthStackParams } from '../../navigation';

type Props = NativeStackScreenProps<AuthStackParams, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!email.trim() || password.length < 8) {
      setError('Email válido y contraseña de al menos 8 caracteres');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      navigation.navigate('VerifyEmail', { email: email.trim(), password });
    } catch (e: any) {
      setError(e.message ?? 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Crear cuenta</Text>

      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#888"
        value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={s.input} placeholder="Contraseña (mín. 8 caracteres)" placeholderTextColor="#888"
        value={password} onChangeText={setPassword} secureTextEntry />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Crear cuenta</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={s.link}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1db954', textAlign: 'center', marginTop: 16, fontSize: 14 },
  error: { color: '#e74c3c', textAlign: 'center', marginBottom: 8 },
});
```

- [ ] **Step 3: Create ForgotPasswordScreen**

```tsx
// mobile/src/screens/auth/ForgotPasswordScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';
import { AuthStackParams } from '../../navigation';

type Props = NativeStackScreenProps<AuthStackParams, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Email enviado</Text>
        <Text style={s.body}>Revisa tu bandeja de entrada y sigue el enlace para restablecer tu contraseña.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={s.link}>Volver al login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Recuperar contraseña</Text>
      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#888"
        value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TouchableOpacity style={s.btn} onPress={handleSend} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Enviar enlace</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={s.link}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 },
  body: { color: '#aaa', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1db954', textAlign: 'center', marginTop: 16, fontSize: 14 },
});
```

- [ ] **Step 4: Create VerifyEmailScreen**

```tsx
// mobile/src/screens/auth/VerifyEmailScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { AuthStackParams } from '../../navigation';

type Props = NativeStackScreenProps<AuthStackParams, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const { email, password } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleCheck = async () => {
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      // login success → RootNavigator switches to MainTabs automatically
    } catch (e: any) {
      setError('Email todavía no verificado. Revisa tu bandeja de entrada.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.emoji}>📬</Text>
      <Text style={s.title}>Verifica tu email</Text>
      <Text style={s.body}>
        Hemos enviado un enlace de verificación a{'\n'}
        <Text style={s.email}>{email}</Text>
        {'\n\n'}Haz clic en el enlace y luego pulsa el botón de abajo.
      </Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={s.btn} onPress={handleCheck} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Ya lo verifiqué</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={s.link}>Volver al login</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  body: { color: '#aaa', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  email: { color: '#1db954', fontWeight: 'bold' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center', width: '100%' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1db954', marginTop: 16, fontSize: 14 },
  error: { color: '#e74c3c', textAlign: 'center', marginBottom: 12 },
});
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/auth/
git commit -m "feat(mobile): add auth screens — Login, Register, ForgotPassword, VerifyEmail"
```

---

## Task 7: Shared components

**Files:**
- Create: `mobile/src/components/NowPlayingBar.tsx`
- Create: `mobile/src/components/TrackRow.tsx`

- [ ] **Step 1: Create NowPlayingBar**

```tsx
// mobile/src/components/NowPlayingBar.tsx
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  trackName: string | null;
  artist: string | null;
}

export default function NowPlayingBar({ trackName, artist }: Props) {
  if (!trackName) return null;
  return (
    <View style={s.bar}>
      <Text style={s.icon}>▶</Text>
      <View style={s.info}>
        <Text style={s.track} numberOfLines={1}>{trackName}</Text>
        <Text style={s.artist} numberOfLines={1}>{artist}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: '#1db954', flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  icon: { color: '#fff', fontSize: 18 },
  info: { flex: 1 },
  track: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  artist: { color: '#d4f5de', fontSize: 12 },
});
```

- [ ] **Step 2: Create TrackRow**

```tsx
// mobile/src/components/TrackRow.tsx
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  id: string;
  trackName: string;
  artist: string;
  albumArt: string | null;
  votes: number;
  userVoted: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
}

export default function TrackRow({ id, trackName, artist, albumArt, votes, userVoted, onVote, onUnvote }: Props) {
  return (
    <View style={s.row}>
      {albumArt ? (
        <Image source={{ uri: albumArt }} style={s.art} />
      ) : (
        <View style={[s.art, s.artPlaceholder]} />
      )}
      <View style={s.info}>
        <Text style={s.track} numberOfLines={1}>{trackName}</Text>
        <Text style={s.artist} numberOfLines={1}>{artist}</Text>
      </View>
      <TouchableOpacity
        style={[s.voteBtn, userVoted && s.votedBtn]}
        onPress={() => userVoted ? onUnvote(id) : onVote(id)}
      >
        <Text style={[s.voteText, userVoted && s.votedText]}>▲ {votes}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, backgroundColor: '#1e1e1e', borderRadius: 8, marginBottom: 6 },
  art: { width: 44, height: 44, borderRadius: 4 },
  artPlaceholder: { backgroundColor: '#333' },
  info: { flex: 1 },
  track: { color: '#fff', fontSize: 14, fontWeight: '600' },
  artist: { color: '#888', fontSize: 12, marginTop: 2 },
  voteBtn: { backgroundColor: '#333', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  votedBtn: { backgroundColor: '#1db954' },
  voteText: { color: '#aaa', fontSize: 13, fontWeight: 'bold' },
  votedText: { color: '#fff' },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/NowPlayingBar.tsx mobile/src/components/TrackRow.tsx
git commit -m "feat(mobile): add NowPlayingBar and TrackRow components"
```

---

## Task 8: SuggestModal component

**Files:**
- Create: `mobile/src/components/SuggestModal.tsx`

- [ ] **Step 1: Create SuggestModal**

```tsx
// mobile/src/components/SuggestModal.tsx
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../api/client';

interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
}

interface Props {
  visible: boolean;
  eventId: string;
  onClose: () => void;
  onSuggested: () => void;
}

export default function SuggestModal({ visible, eventId, onClose, onSuggested }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await apiFetch<SpotifyTrack[]>(`/spotify/search?q=${encodeURIComponent(q)}`);
      setResults(data ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 300);
  };

  const handleSuggest = async (track: SpotifyTrack) => {
    setSubmitting(track.id);
    try {
      await apiFetch(`/events/${eventId}/suggestions`, {
        method: 'POST',
        body: JSON.stringify({
          spotifyTrackId: track.id,
          spotifyUri: track.uri,
          trackName: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          albumArt: track.album.images[0]?.url ?? null,
        }),
      });
      onSuggested();
      onClose();
      setQuery('');
      setResults([]);
    } catch (e: any) {
      // silently ignore duplicate suggestion errors
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Sugerir canción</Text>
          <TouchableOpacity onPress={onClose}><Text style={s.close}>✕</Text></TouchableOpacity>
        </View>
        <TextInput
          style={s.input}
          placeholder="Buscar en Spotify..."
          placeholderTextColor="#888"
          value={query}
          onChangeText={handleChangeText}
          autoFocus
        />
        {loading && <ActivityIndicator color="#1db954" style={{ marginTop: 16 }} />}
        <FlatList
          data={results}
          keyExtractor={t => t.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.track} onPress={() => handleSuggest(item)} disabled={!!submitting}>
              {item.album.images[0] ? (
                <Image source={{ uri: item.album.images[0].url }} style={s.art} />
              ) : (
                <View style={[s.art, s.artPlaceholder]} />
              )}
              <View style={s.info}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <Text style={s.artist} numberOfLines={1}>{item.artists.map(a => a.name).join(', ')}</Text>
              </View>
              {submitting === item.id && <ActivityIndicator color="#1db954" />}
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 32 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  close: { color: '#888', fontSize: 22 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  track: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  art: { width: 48, height: 48, borderRadius: 4 },
  artPlaceholder: { backgroundColor: '#333' },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 14, fontWeight: '600' },
  artist: { color: '#888', fontSize: 12, marginTop: 2 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/SuggestModal.tsx
git commit -m "feat(mobile): add SuggestModal with Spotify search and track suggestion"
```

---

## Task 9: EventsListScreen

**Files:**
- Create: `mobile/src/screens/events/EventsListScreen.tsx`

- [ ] **Step 1: Create the screen**

```tsx
// mobile/src/screens/events/EventsListScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, RefreshControl, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../state/auth';
import { EventsStackParams } from '../../navigation';

interface MusicEvent {
  id: string;
  ownerId: string;
  name: string;
  isPublic: boolean;
  license: 'open' | 'invited' | 'geo';
  isActive: boolean;
  createdAt: string;
}

type Props = NativeStackScreenProps<EventsStackParams, 'EventsList'>;

export default function EventsListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [events, setEvents] = useState<MusicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<MusicEvent[]>('/events');
      setEvents(data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiFetch('/events', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), isPublic: newPublic, license: 'open' }),
      });
      setShowCreate(false);
      setNewName('');
      load();
    } finally {
      setCreating(false);
    }
  };

  const myEvents = events.filter(e => e.ownerId === user?.id);
  const publicEvents = events.filter(e => e.ownerId !== user?.id);

  if (loading) return <View style={s.center}><ActivityIndicator color="#1db954" /></View>;

  return (
    <View style={s.container}>
      <FlatList
        data={[
          { key: 'myHeader', type: 'header', label: 'Mis eventos' },
          ...myEvents.map(e => ({ key: e.id, type: 'event', event: e })),
          { key: 'pubHeader', type: 'header', label: 'Eventos públicos' },
          ...publicEvents.map(e => ({ key: e.id, type: 'event', event: e })),
        ] as any[]}
        keyExtractor={item => item.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1db954" />}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <Text style={s.sectionHeader}>{item.label}</Text>;
          }
          const ev: MusicEvent = item.event;
          return (
            <TouchableOpacity style={s.card} onPress={() => navigation.navigate('EventDetail', { eventId: ev.id, eventName: ev.name })}>
              <Text style={s.eventName}>{ev.name}</Text>
              <Text style={s.eventMeta}>{ev.isPublic ? '🌍 Público' : '🔒 Privado'} · {ev.license}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Nuevo evento</Text>
            <TextInput style={s.input} placeholder="Nombre del evento" placeholderTextColor="#888"
              value={newName} onChangeText={setNewName} />
            <View style={s.row}>
              <Text style={s.label}>Público</Text>
              <Switch value={newPublic} onValueChange={setNewPublic} trackColor={{ true: '#1db954' }} />
            </View>
            <TouchableOpacity style={s.createBtn} onPress={handleCreate} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.createBtnText}>Crear</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={s.cancel}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  sectionHeader: { color: '#888', fontSize: 12, fontWeight: 'bold', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, textTransform: 'uppercase' },
  card: { backgroundColor: '#1e1e1e', marginHorizontal: 16, marginBottom: 8, padding: 16, borderRadius: 10 },
  eventName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  eventMeta: { color: '#888', fontSize: 13, marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#1db954', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: { backgroundColor: '#282828', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  label: { color: '#fff', fontSize: 15 },
  createBtn: { backgroundColor: '#1db954', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 10 },
  createBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancel: { color: '#888', textAlign: 'center', fontSize: 14 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/events/EventsListScreen.tsx
git commit -m "feat(mobile): add EventsListScreen with create event modal"
```

---

## Task 10: EventDetailScreen

**Files:**
- Create: `mobile/src/screens/events/EventDetailScreen.tsx`

- [ ] **Step 1: Create the screen**

```tsx
// mobile/src/screens/events/EventDetailScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { io, Socket } from 'socket.io-client';
import NowPlayingBar from '../../components/NowPlayingBar';
import SuggestModal from '../../components/SuggestModal';
import TrackRow from '../../components/TrackRow';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../state/auth';
import { useSettings } from '../../state/settings';
import { EventsStackParams } from '../../navigation';

interface Suggestion {
  id: string;
  trackName: string;
  artist: string;
  albumArt: string | null;
  votes: string;
  userVoted: boolean;
}

interface NowPlaying {
  trackName: string;
  artist: string;
}

type Props = NativeStackScreenProps<EventsStackParams, 'EventDetail'>;

export default function EventDetailScreen({ route }: Props) {
  const { eventId } = route.params;
  const { token } = useAuth();
  const { backendUrl } = useSettings();

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const loadSuggestions = useCallback(async () => {
    try {
      const data = await apiFetch<Suggestion[]>(`/events/${eventId}/suggestions`);
      setSuggestions(data ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadSuggestions();

    const socket = io(backendUrl, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('join', { eventId });
    socket.on('queue:updated', () => loadSuggestions());
    socket.on('track:playing', (data: { trackName: string; artist: string }) => {
      setNowPlaying(data);
    });
    socket.on('queue:empty', () => setNowPlaying(null));

    return () => {
      socket.emit('leave', { eventId });
      socket.disconnect();
    };
  }, [eventId, backendUrl, token, loadSuggestions]);

  const handleVote = async (id: string) => {
    try {
      await apiFetch(`/suggestions/${id}/vote`, { method: 'POST' });
      loadSuggestions();
    } catch { /* ignore — already voted */ }
  };

  const handleUnvote = async (id: string) => {
    try {
      await apiFetch(`/suggestions/${id}/vote`, { method: 'DELETE' });
      loadSuggestions();
    } catch { /* ignore */ }
  };

  return (
    <View style={s.container}>
      <NowPlayingBar trackName={nowPlaying?.trackName ?? null} artist={nowPlaying?.artist ?? null} />

      <FlatList
        data={suggestions}
        keyExtractor={suggestion => suggestion.id}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSuggestions(); }} tintColor="#1db954" />}
        ListEmptyComponent={<Text style={st.empty}>Sin pistas en la cola. ¡Sugiere la primera!</Text>}
        renderItem={({ item }) => (
          <TrackRow
            id={item.id}
            trackName={item.trackName}
            artist={item.artist}
            albumArt={item.albumArt}
            votes={Number(item.votes)}
            userVoted={Boolean(item.userVoted)}
            onVote={handleVote}
            onUnvote={handleUnvote}
          />
        )}
      />

      <TouchableOpacity style={st.fab} onPress={() => setShowSuggest(true)}>
        <Text style={st.fabText}>+ Sugerir</Text>
      </TouchableOpacity>

      <SuggestModal
        visible={showSuggest}
        eventId={eventId}
        onClose={() => setShowSuggest(false)}
        onSuggested={loadSuggestions}
      />
    </View>
  );
}

const s = StyleSheet.create({ container: { flex: 1, backgroundColor: '#121212' } });
const st = StyleSheet.create({
  empty: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 16, backgroundColor: '#1db954', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, elevation: 4 },
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/events/EventDetailScreen.tsx
git commit -m "feat(mobile): add EventDetailScreen with voting queue and Socket.IO real-time"
```

---

## Task 11: SearchEventsScreen

**Files:**
- Create: `mobile/src/screens/search/SearchEventsScreen.tsx`

- [ ] **Step 1: Create the screen**

```tsx
// mobile/src/screens/search/SearchEventsScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';
import { SearchStackParams } from '../../navigation';

interface MusicEvent {
  id: string;
  name: string;
  isPublic: boolean;
  ownerId: string;
}

type Props = NativeStackScreenProps<SearchStackParams, 'SearchEvents'>;

export default function SearchEventsScreen({ navigation }: Props) {
  const [allEvents, setAllEvents] = useState<MusicEvent[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<MusicEvent[]>('/events');
      setAllEvents(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allEvents;
    const q = query.toLowerCase();
    return allEvents.filter(e => e.name.toLowerCase().includes(q));
  }, [query, allEvents]);

  if (loading) return <View style={s.center}><ActivityIndicator color="#1db954" /></View>;

  return (
    <View style={s.container}>
      <TextInput
        style={s.input}
        placeholder="Buscar evento..."
        placeholderTextColor="#888"
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={filtered}
        keyExtractor={e => e.id}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={s.empty}>No hay eventos que coincidan.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('EventDetail', { eventId: item.id, eventName: item.name })}
          >
            <Text style={s.name}>{item.name}</Text>
            <Text style={s.badge}>{item.isPublic ? '🌍 Público' : '🔒 Privado'}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 12, marginHorizontal: 12, marginBottom: 8, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  card: { backgroundColor: '#1e1e1e', padding: 14, borderRadius: 10, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  badge: { color: '#888', fontSize: 13 },
  empty: { color: '#888', textAlign: 'center', marginTop: 40 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/search/SearchEventsScreen.tsx
git commit -m "feat(mobile): add SearchEventsScreen with client-side event filtering"
```

---

## Task 12: FriendsScreen

**Files:**
- Create: `mobile/src/screens/friends/FriendsScreen.tsx`

- [ ] **Step 1: Create the screen**

```tsx
// mobile/src/screens/friends/FriendsScreen.tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';

interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted';
}

interface UserResult {
  id: string;
  email: string;
}

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<UserResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [addingId, setAddingId] = useState('');

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([
        apiFetch<Friendship[]>('/friends'),
        apiFetch<Friendship[]>('/friends/requests'),
      ]);
      setFriends(f ?? []);
      setRequests(r ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const results = await apiFetch<UserResult[]>(`/users/search?q=${encodeURIComponent(searchEmail.trim())}`);
      setSearchResult(results?.[0] ?? null);
      if (!results?.length) setSearchError('Usuario no encontrado');
    } catch {
      setSearchError('Error al buscar');
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (email: string) => {
    setAddingId(email);
    try {
      await apiFetch('/friends', { method: 'POST', body: JSON.stringify({ email }) });
      setSearchResult(null);
      setSearchEmail('');
      load();
    } catch (e: any) {
      setSearchError(e.message ?? 'Error al enviar solicitud');
    } finally {
      setAddingId('');
    }
  };

  const handleAccept = async (id: string) => {
    await apiFetch(`/friends/${id}/accept`, { method: 'PUT' });
    load();
  };

  const handleRemove = async (id: string) => {
    await apiFetch(`/friends/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#1db954" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>

      <Text style={s.section}>Buscar usuario</Text>
      <View style={s.row}>
        <TextInput style={[s.input, { flex: 1 }]} placeholder="Email del usuario" placeholderTextColor="#888"
          value={searchEmail} onChangeText={setSearchEmail} autoCapitalize="none" keyboardType="email-address" />
        <TouchableOpacity style={s.searchBtn} onPress={handleSearch} disabled={searching}>
          {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.searchBtnText}>Buscar</Text>}
        </TouchableOpacity>
      </View>
      {searchError ? <Text style={s.error}>{searchError}</Text> : null}
      {searchResult && (
        <View style={s.card}>
          <Text style={s.cardText}>{searchResult.email}</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => handleAdd(searchResult.email)} disabled={!!addingId}>
            <Text style={s.addBtnText}>+ Añadir</Text>
          </TouchableOpacity>
        </View>
      )}

      {requests.length > 0 && (
        <>
          <Text style={s.section}>Solicitudes pendientes</Text>
          {requests.map(r => (
            <View key={r.id} style={s.card}>
              <Text style={s.cardText}>{r.userId}</Text>
              <View style={s.actions}>
                <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(r.id)}>
                  <Text style={s.acceptText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={() => handleRemove(r.id)}>
                  <Text style={s.rejectText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={s.section}>Mis amigos</Text>
      {friends.length === 0 && <Text style={s.empty}>Aún no tienes amigos.</Text>}
      {friends.map(f => (
        <View key={f.id} style={s.card}>
          <Text style={s.cardText}>{f.friendId}</Text>
          <TouchableOpacity onPress={() => handleRemove(f.id)}>
            <Text style={s.removeText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      ))}

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  section: { color: '#888', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, marginTop: 20 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#333' },
  searchBtn: { backgroundColor: '#1db954', borderRadius: 8, padding: 12, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: 'bold' },
  card: { backgroundColor: '#1e1e1e', borderRadius: 8, padding: 14, marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardText: { color: '#fff', fontSize: 14 },
  addBtn: { backgroundColor: '#1db954', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: '#1db954', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText: { color: '#fff', fontWeight: 'bold' },
  rejectBtn: { backgroundColor: '#333', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  rejectText: { color: '#aaa', fontWeight: 'bold' },
  removeText: { color: '#e74c3c', fontSize: 13 },
  error: { color: '#e74c3c', fontSize: 13, marginBottom: 8 },
  empty: { color: '#555', fontSize: 14 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/friends/FriendsScreen.tsx
git commit -m "feat(mobile): add FriendsScreen with search, requests, and friends list"
```

---

## Task 13: ProfileScreen + SettingsScreen

**Files:**
- Create: `mobile/src/screens/profile/ProfileScreen.tsx`
- Create: `mobile/src/screens/profile/SettingsScreen.tsx`

- [ ] **Step 1: Create ProfileScreen**

```tsx
// mobile/src/screens/profile/ProfileScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';
import { ProfileStackParams } from '../../navigation';

type Visibility = 'public' | 'friends' | 'private';

interface Profile {
  displayName: string | null;
  bio: string | null;
  city: string | null;
  bioVisibility: Visibility;
  musicGenres: string | null;
  favoriteArtists: string | null;
  musicVisibility: Visibility;
}

const VIS_OPTIONS: Visibility[] = ['public', 'friends', 'private'];
const VIS_LABELS: Record<Visibility, string> = { public: '🌍', friends: '👥', private: '🔒' };

type Props = NativeStackScreenProps<ProfileStackParams, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Profile>('/users/me');
      setProfile(data);
      setForm(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await apiFetch('/users/me', { method: 'PUT', body: JSON.stringify(form) });
      setProfile(form);
    } finally {
      setSaving(false);
    }
  };

  const nextVisibility = (v: Visibility): Visibility => {
    const idx = VIS_OPTIONS.indexOf(v);
    return VIS_OPTIONS[(idx + 1) % VIS_OPTIONS.length];
  };

  if (loading || !form) return <View style={s.center}><ActivityIndicator color="#1db954" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>

      <Text style={s.label}>Nombre de display</Text>
      <TextInput style={s.input} value={form.displayName ?? ''} onChangeText={v => setForm({ ...form, displayName: v })} placeholder="Tu nombre" placeholderTextColor="#888" />

      <View style={s.row}>
        <Text style={s.label}>Bio</Text>
        <TouchableOpacity onPress={() => setForm({ ...form, bioVisibility: nextVisibility(form.bioVisibility) })}>
          <Text style={s.vis}>{VIS_LABELS[form.bioVisibility]}</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={[s.input, { height: 80 }]} value={form.bio ?? ''} onChangeText={v => setForm({ ...form, bio: v })}
        placeholder="Cuéntanos algo sobre ti" placeholderTextColor="#888" multiline />

      <Text style={s.label}>Ciudad</Text>
      <TextInput style={s.input} value={form.city ?? ''} onChangeText={v => setForm({ ...form, city: v })} placeholder="Tu ciudad" placeholderTextColor="#888" />

      <View style={s.row}>
        <Text style={s.label}>Géneros musicales</Text>
        <TouchableOpacity onPress={() => setForm({ ...form, musicVisibility: nextVisibility(form.musicVisibility) })}>
          <Text style={s.vis}>{VIS_LABELS[form.musicVisibility]}</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={s.input} value={form.musicGenres ?? ''} onChangeText={v => setForm({ ...form, musicGenres: v })}
        placeholder="Rock, Jazz, Pop..." placeholderTextColor="#888" />

      <Text style={s.label}>Artistas favoritos</Text>
      <TextInput style={s.input} value={form.favoriteArtists ?? ''} onChangeText={v => setForm({ ...form, favoriteArtists: v })}
        placeholder="The Beatles, Dua Lipa..." placeholderTextColor="#888" />

      <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Guardar</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={s.settingsLink} onPress={() => navigation.navigate('Settings')}>
        <Text style={s.settingsLinkText}>⚙ Ajustes</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  label: { color: '#888', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vis: { fontSize: 20, padding: 4 },
  saveBtn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  settingsLink: { alignItems: 'center', marginTop: 20, marginBottom: 40 },
  settingsLinkText: { color: '#888', fontSize: 15 },
});
```

- [ ] **Step 2: Create SettingsScreen**

```tsx
// mobile/src/screens/profile/SettingsScreen.tsx
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useSettings } from '../../state/settings';

export default function SettingsScreen() {
  const { backendUrl, setBackendUrl } = useSettings();
  const { logout } = useAuth();
  const [url, setUrl] = useState(backendUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await setBackendUrl(url.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={s.container}>
      <Text style={s.label}>URL del backend</Text>
      <Text style={s.hint}>Cambia esto para apuntar a otro servidor durante las pruebas.</Text>
      <TextInput style={s.input} value={url} onChangeText={setUrl}
        autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
        <Text style={s.saveBtnText}>{saved ? '✓ Guardado' : 'Guardar URL'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24 },
  label: { color: '#888', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6, marginTop: 20 },
  hint: { color: '#555', fontSize: 13, marginBottom: 10 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  saveBtn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  logoutBtn: { marginTop: 48, borderRadius: 8, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e74c3c' },
  logoutText: { color: '#e74c3c', fontWeight: 'bold', fontSize: 15 },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/profile/ProfileScreen.tsx mobile/src/screens/profile/SettingsScreen.tsx
git commit -m "feat(mobile): add ProfileScreen with visibility toggles and SettingsScreen"
```

---

## Task 14: Wire up App.tsx and smoke test

**Files:**
- Modify: `mobile/App.tsx` (already correct — imports `useAuth` hydrate and `RootNavigator`)
- Modify: `mobile/app.json` (add scheme for OAuth redirect)

- [ ] **Step 1: Add scheme to app.json (required for Google OAuth)**

Edit `mobile/app.json` to add a scheme:

```json
{
  "expo": {
    "name": "mobile",
    "slug": "mobile",
    "scheme": "musicroom",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "ios": { "supportsTablet": true },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": { "favicon": "./assets/favicon.png" }
  }
}
```

- [ ] **Step 2: Start the backend and app**

```bash
# Terminal 1 — backend
cd backend && npm run start:dev

# Terminal 2 — mobile
cd mobile && npx expo start
```

- [ ] **Step 3: Smoke test checklist**

Test these flows manually:

1. Register a new user → arrives at VerifyEmail screen
2. Verify email (click link in email) → tap "Ya lo verifiqué" → lands on EventsList
3. Logout from Settings → returns to Login
4. Login again with email/password → lands on EventsList
5. Create an event → appears in "Mis eventos"
6. Tap event → EventDetail screen with empty queue
7. Tap "+ Sugerir" → search modal opens, type "Beatles" → results appear
8. Tap a result → suggestion appears in queue with 0 votes
9. Tap ▲ vote button → vote count increments
10. Tap again → vote removed
11. Go to Buscar tab → type event name → result appears, tap → EventDetail
12. Go to Amigos tab → search by email, send request
13. Go to Perfil → edit display name → tap Guardar
14. Go to Perfil → Ajustes → change backend URL → Guardar

- [ ] **Step 4: Final commit**

```bash
git add mobile/app.json
git commit -m "feat(mobile): add OAuth scheme to app.json"
```

---

## Google OAuth setup (manual, required for Google login)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → Create OAuth 2.0 client → **Web application**
2. Add authorized redirect URI: `https://auth.expo.io/@your-expo-username/mobile`
3. Copy the **Web Client ID**
4. Create `mobile/.env` with:
   ```
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```
5. Add `mobile/.env` to `.gitignore`

Without this, the Google button is disabled but all email/password flows work normally.
