// mobile/src/state/settings.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'settings.backendUrl';
const DEFAULT_URL = 'http://10.13.8.4:3000';

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
