// mobile/src/api/client.ts
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { useAuth } from '../state/auth';
import { useSettings } from '../state/settings';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Cabeceras que el backend guarda en action_logs con cada petición (V.6).
// Las usa cualquier fetch al backend, también los de state/auth.ts
export function deviceHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-platform': Platform.OS,
    'x-device': Device.modelName ?? 'unknown',
    'x-app-version': Constants.expoConfig?.version ?? 'unknown',
  };
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
    const headers: Record<string, string> = { ...deviceHeaders() };
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
      headers: deviceHeaders(),
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
    let message = 'Error de conexión con el servidor';
    try {
      const body = await res.json();
      // Los errores de validación llegan como lista de mensajes
      message = Array.isArray(body.message) ? body.message.join('\n') : body.message ?? message;
    } catch { /* empty */ }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
