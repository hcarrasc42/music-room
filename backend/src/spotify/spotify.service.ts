import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Track {
  id: string;
  uri: string;
  name: string;
  artist: string;
  albumArt: string;
}

export interface PlayerState {
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  trackId: string | null;
  trackName: string | null;
  artist: string | null;
  albumArt: string | null;
}

interface SpotifyTrackItem {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
}

interface SpotifyPlayerResponse {
  is_playing: boolean;
  progress_ms: number;
  item?: {
    id: string;
    duration_ms: number;
    name: string;
    artists: { name: string }[];
    album: { images: { url: string }[] };
  };
}

@Injectable()
export class SpotifyService {
  private userToken: string | null = null;
  private userTokenExpiresAt = 0;
  private clientToken: string | null = null;
  private clientTokenExpiresAt = 0;
  private hasActiveDevice = false;

  constructor(private cfg: ConfigService) {}

  private get basicAuth(): string {
    const id = this.cfg.getOrThrow('SPOTIFY_CLIENT_ID');
    const secret = this.cfg.getOrThrow('SPOTIFY_CLIENT_SECRET');
    return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
  }

  private async getClientToken(): Promise<string> {
    if (this.clientToken && Date.now() < this.clientTokenExpiresAt - 30_000) {
      return this.clientToken;
    }
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: this.basicAuth },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    if (!res.ok) throw new InternalServerErrorException('Failed to get Spotify client token');
    const data = await res.json() as { access_token: string; expires_in: number };
    this.clientToken = data.access_token;
    this.clientTokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.clientToken;
  }

  private async getUserToken(): Promise<string> {
    if (this.userToken && Date.now() < this.userTokenExpiresAt - 30_000) {
      return this.userToken;
    }
    const refreshToken = this.cfg.getOrThrow('SPOTIFY_REFRESH_TOKEN');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: this.basicAuth },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!res.ok) throw new InternalServerErrorException('Failed to refresh Spotify token');
    const data = await res.json() as { access_token: string; expires_in: number };
    this.userToken = data.access_token;
    this.userTokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.userToken;
  }

  private async spotifyFetch(path: string, options: RequestInit = {}, useClientCredentials = false): Promise<Response> {
    const token = useClientCredentials ? await this.getClientToken() : await this.getUserToken();
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) ?? {}),
      },
    });
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new InternalServerErrorException(body?.error?.message ?? `Spotify error ${res.status}`);
    }
    return res;
  }

  async search(query: string): Promise<Track[]> {
    const res = await this.spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {}, true);
    const data = await res.json() as { tracks: { items: SpotifyTrackItem[] } };
    return data.tracks.items.map(item => ({
      id: item.id,
      uri: item.uri,
      name: item.name,
      artist: item.artists[0]?.name ?? '',
      albumArt: item.album.images[0]?.url ?? '',
    }));
  }

  async play(trackUri: string): Promise<void> {
    await this.ensureActiveDevice();
    await this.spotifyFetch('/me/player/play', {
      method: 'PUT',
      body: JSON.stringify({ uris: [trackUri] }),
    });
    this.hasActiveDevice = true;
  }

  async resume(): Promise<void> {
    await this.ensureActiveDevice();
    await this.spotifyFetch('/me/player/play', { method: 'PUT' });
    this.hasActiveDevice = true;
  }

  async pause(): Promise<void> {
    await this.spotifyFetch('/me/player/pause', { method: 'PUT' });
  }

  async next(): Promise<void> {
    await this.ensureActiveDevice();
    await this.spotifyFetch('/me/player/next', { method: 'POST' });
  }

  async previous(): Promise<void> {
    await this.ensureActiveDevice();
    await this.spotifyFetch('/me/player/previous', { method: 'POST' });
  }

  async seek(positionMs: number): Promise<void> {
    await this.ensureActiveDevice();
    await this.spotifyFetch(`/me/player/seek?position_ms=${Math.round(positionMs)}`, { method: 'PUT' });
  }

  async setVolume(percent: number): Promise<void> {
    await this.spotifyFetch(`/me/player/volume?volume_percent=${percent}`, { method: 'PUT' });
  }

  private async ensureActiveDevice(): Promise<void> {
    if (this.hasActiveDevice) return;
    const devRes = await this.spotifyFetch('/me/player/devices');
    const devData = await devRes.json().catch(() => ({ devices: [] })) as { devices: { id: string; name: string }[] };
    if (!devData.devices?.length) {
      throw new InternalServerErrorException('No hay ningún dispositivo Spotify disponible. Abre Spotify en tu dispositivo.');
    }
    await this.spotifyFetch('/me/player', {
      method: 'PUT',
      body: JSON.stringify({ device_ids: [devData.devices[0].id], play: false }),
    });
    await new Promise<void>(r => setTimeout(r, 400));
    this.hasActiveDevice = true;
  }

  async getPlayer(): Promise<PlayerState | null> {
    const res = await this.spotifyFetch('/me/player');
    if (res.status === 204) {
      this.hasActiveDevice = false;
      return null;
    }
    this.hasActiveDevice = true;
    const data = await res.json() as SpotifyPlayerResponse;
    return {
      isPlaying: data.is_playing,
      progressMs: data.progress_ms,
      durationMs: data.item?.duration_ms ?? 0,
      trackName: data.item?.name ?? null,
      artist: data.item?.artists?.[0]?.name ?? null,
      albumArt: data.item?.album?.images?.[0]?.url ?? null,
      trackId: data.item?.id ?? null,
    };
  }
}
