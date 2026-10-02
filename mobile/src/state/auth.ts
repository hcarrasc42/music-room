// mobile/src/state/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { apiFetch, deviceHeaders } from '../api/client';
import { useSettings } from './settings';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
}

interface Tokens {
  access_token: string;
  refresh_token: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hydrating: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  loginGoogle: (idToken: string) => Promise<void>;
  changePassword: (currentPassword: string | undefined, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  _setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
}

const baseUrl = () => useSettings.getState().backendUrl;

// POST al backend con las cabeceras de dispositivo; lanza Error con el mensaje del backend
// (sin sesión: login, verificación, refresh, logout)
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, { method: 'POST', headers: deviceHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = Array.isArray(data.message) ? data.message.join('\n') : data.message;
    throw new Error(message ?? 'Error de conexión con el servidor');
  }
  return data as T;
}

async function fetchMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${baseUrl()}/users/me`, {
    headers: { ...deviceHeaders(), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

const clearStorage = () => AsyncStorage.multiRemove(['auth.token', 'auth.refreshToken']);

export const useAuth = create<AuthState>((set, get) => {
  // Guarda la sesión recibida del backend y carga el usuario
  const startSession = async (tokens: Tokens) => {
    await get()._setTokens(tokens.access_token, tokens.refresh_token);
    const user = await fetchMe(tokens.access_token);
    set({ user });
  };

  return {
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

      // Validate token
      try {
        const user = await fetchMe(token);
        set({ token, refreshToken, user, hydrating: false });
        return;
      } catch {
        // Token may be expired — try refresh
      }

      if (!refreshToken) {
        await clearStorage();
        set({ hydrating: false });
        return;
      }

      try {
        await startSession(await post<Tokens>('/auth/refresh', { refresh_token: refreshToken }));
        set({ hydrating: false });
      } catch {
        await clearStorage();
        set({ token: null, refreshToken: null, user: null, hydrating: false });
      }
    },

    login: async (email, password) => {
      await startSession(await post<Tokens>('/auth/login', { email, password }));
    },

    verifyEmail: async (email, code) => {
      await startSession(await post<Tokens>('/auth/verify-email', { email, code }));
    },

    loginGoogle: async (idToken) => {
      await startSession(await post<Tokens>('/auth/google', { idToken }));
    },

    // El backend cierra las demás sesiones y devuelve una nueva para este dispositivo
    changePassword: async (currentPassword, newPassword) => {
      // apiFetch renueva el access token si ha caducado
      const tokens = await apiFetch<Tokens>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      await get()._setTokens(tokens.access_token, tokens.refresh_token);
    },

    // Revoca la sesión en el servidor; si no hay conexión se cierra igualmente en el móvil
    logout: async () => {
      const { refreshToken } = get();
      if (refreshToken) await post('/auth/logout', { refresh_token: refreshToken }).catch(() => undefined);
      await clearStorage();
      set({ token: null, refreshToken: null, user: null });
    },

    // A diferencia de logout, si falla no se cierra nada: el usuario tiene que saber que no se aplicó
    logoutAll: async () => {
      await apiFetch('/auth/logout-all', { method: 'POST' });
      await clearStorage();
      set({ token: null, refreshToken: null, user: null });
    },

    _setTokens: async (accessToken, newRefreshToken) => {
      await AsyncStorage.setItem('auth.token', accessToken);
      await AsyncStorage.setItem('auth.refreshToken', newRefreshToken);
      set({ token: accessToken, refreshToken: newRefreshToken });
    },
  };
});
