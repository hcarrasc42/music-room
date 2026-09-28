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
