// mobile/src/screens/events/EventDetailScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, FlatList, RefreshControl, StyleSheet, TouchableOpacity, Text, View } from 'react-native';
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
  suggestedById: string;
}

interface PlayerState {
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  trackName: string | null;
  artist: string | null;
  albumArt: string | null;
}

type Props = NativeStackScreenProps<EventsStackParams, 'EventDetail'>;

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function EventDetailScreen({ route }: Props) {
  const { eventId } = route.params;
  const { token, user } = useAuth();
  const { backendUrl } = useSettings();

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [barWidth, setBarWidth] = useState(1);
  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const loadSuggestions = useCallback(async () => {
    setLoadError('');
    try {
      const data = await apiFetch<Suggestion[]>(`/events/${eventId}/suggestions`);
      setSuggestions(data ?? []);
    } catch {
      setLoadError('No se pudo cargar la cola');
    } finally {
      setRefreshing(false);
    }
  }, [eventId]);

  const pollPlayer = useCallback(async () => {
    try {
      const data = await apiFetch<PlayerState | null>('/spotify/player');
      setPlayer(data);
    } catch {
      // silently ignore — Spotify may not be active
    }
  }, []);

  useEffect(() => {
    loadSuggestions();
    void pollPlayer();
    pollRef.current = setInterval(() => { void pollPlayer(); }, 2000);

    const socket = io(backendUrl, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('join', { eventId });
    socket.on('queue:updated', () => loadSuggestions());
    socket.on('queue:empty', () => setPlayer(null));

    return () => {
      clearInterval(pollRef.current);
      socket.emit('leave', { eventId });
      socket.disconnect();
    };
  }, [eventId, backendUrl, token, loadSuggestions, pollPlayer]);

  const handleVote = async (id: string) => {
    try {
      await apiFetch(`/suggestions/${id}/vote`, { method: 'POST' });
      loadSuggestions();
    } catch (e: any) {
      if (e?.status !== 409) Alert.alert('Error', 'No se pudo votar');
    }
  };

  const handleUnvote = async (id: string) => {
    try {
      await apiFetch(`/suggestions/${id}/vote`, { method: 'DELETE' });
      loadSuggestions();
    } catch (e: any) {
      if (e?.status !== 409) Alert.alert('Error', 'No se pudo quitar el voto');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/suggestions/${id}`, { method: 'DELETE' });
      loadSuggestions();
    } catch {
      Alert.alert('Error', 'No se pudo eliminar la sugerencia');
    }
  };

  const handlePlayPause = async () => {
    try {
      if (player?.isPlaying) {
        await apiFetch('/spotify/pause', { method: 'POST' });
      } else {
        await apiFetch('/spotify/play', { method: 'POST' });
      }
      await pollPlayer();
    } catch {
      Alert.alert('Error', 'No se pudo controlar la reproducción');
    }
  };

  const handleNext = async () => {
    try {
      await apiFetch('/spotify/next', { method: 'POST' });
      setTimeout(() => { void pollPlayer(); }, 500);
    } catch {
      Alert.alert('Error', 'No se pudo cambiar la canción');
    }
  };

  const handlePrevious = async () => {
    try {
      await apiFetch('/spotify/previous', { method: 'POST' });
      setTimeout(() => { void pollPlayer(); }, 500);
    } catch {
      Alert.alert('Error', 'No se pudo cambiar la canción');
    }
  };

  const handleSeek = (x: number) => {
    if (!player?.durationMs) return;
    const ratio = Math.max(0, Math.min(1, x / barWidth));
    const positionMs = Math.floor(ratio * player.durationMs);
    apiFetch('/spotify/seek', { method: 'POST', body: JSON.stringify({ positionMs }) })
      .then(() => pollPlayer())
      .catch(() => {});
  };

  const progress = player?.durationMs
    ? Math.floor((player.progressMs / player.durationMs) * barWidth)
    : 0;

  return (
    <View style={s.container}>
      <NowPlayingBar trackName={player?.trackName ?? null} artist={player?.artist ?? null} />

      {player && (
        <View style={p.container}>
          <View style={p.progressRow}>
            <Text style={p.time}>{formatMs(player.progressMs)}</Text>
            <TouchableOpacity
              style={p.barTrack}
              onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
              onPress={e => handleSeek(e.nativeEvent.locationX)}
              activeOpacity={1}
            >
              <View style={[p.barFill, { width: progress }]} />
            </TouchableOpacity>
            <Text style={p.time}>{formatMs(player.durationMs)}</Text>
          </View>
          <View style={p.controls}>
            <TouchableOpacity style={p.ctrlBtn} onPress={handlePrevious}>
              <Ionicons name="play-skip-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={p.playBtn} onPress={handlePlayPause}>
              <Ionicons name={player.isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={p.ctrlBtn} onPress={handleNext}>
              <Ionicons name="play-skip-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loadError ? <Text style={st.error}>{loadError}</Text> : null}

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
            canDelete={item.suggestedById === user?.id}
            onDelete={handleDelete}
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
});
const p = StyleSheet.create({
  container: { backgroundColor: '#1a1a1a', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  time: { color: '#888', fontSize: 11, minWidth: 32, textAlign: 'center' },
  barTrack: { flex: 1, height: 4, backgroundColor: '#333', borderRadius: 2, justifyContent: 'center' },
  barFill: { height: 4, backgroundColor: '#1db954', borderRadius: 2 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24 },
  ctrlBtn: { padding: 8 },
  playBtn: { backgroundColor: '#1db954', borderRadius: 24, width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
});
const st = StyleSheet.create({
  empty: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 15 },
  error: { color: '#e74c3c', textAlign: 'center', padding: 12, fontSize: 14 },
  fab: { position: 'absolute', bottom: 24, right: 16, backgroundColor: '#1db954', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, elevation: 4 },
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
