// mobile/src/screens/events/EventDetailScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, FlatList, PanResponder, RefreshControl, StyleSheet, TouchableOpacity, Text, View } from 'react-native';
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

const HANDLE_SIZE = 14;
const TOUCH_AREA_HEIGHT = 28;
const BAR_HEIGHT = 4;

export default function EventDetailScreen({ route }: Props) {
  const { eventId, ownerId } = route.params;
  const { token, user } = useAuth();
  const { backendUrl } = useSettings();
  const isOwner = user?.id === ownerId;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [dragX, setDragX] = useState<number | null>(null);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);

  const socketRef = useRef<Socket | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const barWidthRef = useRef(1);
  const playerRef = useRef<PlayerState | null>(null);
  const pollPlayerRef = useRef<() => Promise<void>>(() => Promise.resolve());

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
      playerRef.current = data;
    } catch {
      // silently ignore — Spotify may not be active
    }
  }, []);

  pollPlayerRef.current = pollPlayer;

  useEffect(() => {
    loadSuggestions();
    void pollPlayer();
    pollRef.current = setInterval(() => { void pollPlayerRef.current(); }, 2000);

    const socket = io(backendUrl, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('join', { eventId });
    socket.on('queue:updated', () => loadSuggestions());
    socket.on('queue:empty', () => { setPlayer(null); playerRef.current = null; });

    return () => {
      clearInterval(pollRef.current);
      socket.emit('leave', { eventId });
      socket.disconnect();
    };
  }, [eventId, backendUrl, token, loadSuggestions, pollPlayer]);

  // Always-fresh seek function — captured by ref so PanResponder (created once) sees latest state
  const seekCommitRef = useRef<(x: number) => void>(() => {});
  seekCommitRef.current = (x: number) => {
    const p = playerRef.current;
    if (!p?.durationMs) return;
    const ratio = Math.max(0, Math.min(1, x / barWidthRef.current));
    const positionMs = Math.floor(ratio * p.durationMs);
    apiFetch(`/events/${eventId}/player/seek`, { method: 'POST', body: JSON.stringify({ positionMs }) })
      .then(() => pollPlayerRef.current())
      .catch(() => {});
  };

  // Capture-phase PanResponder: claims gesture before the FlatList can scroll.
  // setListScrollEnabled(false) ensures FlatList is disabled for the duration of the drag.
  const seekPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (e) => {
        setListScrollEnabled(false);
        setDragX(Math.max(0, Math.min(barWidthRef.current, e.nativeEvent.locationX)));
      },
      onPanResponderMove: (e) => {
        setDragX(Math.max(0, Math.min(barWidthRef.current, e.nativeEvent.locationX)));
      },
      onPanResponderRelease: (e) => {
        setListScrollEnabled(true);
        setDragX(null);
        seekCommitRef.current(e.nativeEvent.locationX);
      },
      onPanResponderTerminate: () => {
        setListScrollEnabled(true);
        setDragX(null);
      },
    })
  ).current;

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
        await apiFetch(`/events/${eventId}/player/pause`, { method: 'POST' });
      } else {
        await apiFetch(`/events/${eventId}/player/resume`, { method: 'POST' });
      }
      await pollPlayer();
    } catch {
      Alert.alert('Error', 'No se pudo controlar la reproducción');
    }
  };

  const handleNext = async () => {
    try {
      await apiFetch(`/events/${eventId}/player/next`, { method: 'POST' });
      setTimeout(() => { void pollPlayer(); }, 500);
    } catch {
      Alert.alert('Error', 'No se pudo cambiar la canción');
    }
  };

  const handlePrevious = async () => {
    try {
      await apiFetch(`/events/${eventId}/player/previous`, { method: 'POST' });
      setTimeout(() => { void pollPlayer(); }, 500);
    } catch {
      Alert.alert('Error', 'No se pudo cambiar la canción');
    }
  };

  const progress = player?.durationMs
    ? Math.floor((player.progressMs / player.durationMs) * barWidthRef.current)
    : 0;
  const fillWidth = dragX !== null ? dragX : progress;
  // Clamp handle so it stays within the bar bounds
  const handleLeft = Math.max(0, Math.min(fillWidth - HANDLE_SIZE / 2, barWidthRef.current - HANDLE_SIZE));

  return (
    <View style={s.container}>
      <NowPlayingBar trackName={player?.trackName ?? null} artist={player?.artist ?? null} />

      {isOwner && player && (
        <View style={p.container}>
          <View style={p.progressRow}>
            <Text style={p.time}>{formatMs(player.progressMs)}</Text>

            <View
              style={p.barTouchArea}
              onLayout={e => { barWidthRef.current = e.nativeEvent.layout.width; }}
              {...seekPan.panHandlers}
            >
              {/* Grey track */}
              <View style={p.barBg}>
                <View style={[p.barFill, { width: fillWidth }]} />
              </View>
              {/* Draggable circle handle */}
              <View style={[p.barHandle, { left: handleLeft }]} />
            </View>

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
        scrollEnabled={listScrollEnabled}
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
  container: { backgroundColor: '#1a1a1a', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  time: { color: '#888', fontSize: 11, minWidth: 32, textAlign: 'center' },
  barTouchArea: { flex: 1, height: TOUCH_AREA_HEIGHT, justifyContent: 'center' },
  barBg: { height: BAR_HEIGHT, backgroundColor: '#333', borderRadius: BAR_HEIGHT / 2, overflow: 'hidden' },
  barFill: { height: BAR_HEIGHT, backgroundColor: '#1db954' },
  // Absolutely positioned over barTouchArea; top centers the circle vertically
  barHandle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: '#1db954',
    top: (TOUCH_AREA_HEIGHT - HANDLE_SIZE) / 2,
  },
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
