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
