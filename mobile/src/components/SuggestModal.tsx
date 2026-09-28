import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../api/client';

interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artist: string;
  albumArt: string;
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
          artist: track.artist,
          albumArt: track.albumArt || null,
        }),
      });
      onSuggested();
      onClose();
      setQuery('');
      setResults([]);
    } catch {
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
              {item.albumArt ? (
                <Image source={{ uri: item.albumArt }} style={s.art} />
              ) : (
                <View style={[s.art, s.artPlaceholder]} />
              )}
              <View style={s.info}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <Text style={s.artist} numberOfLines={1}>{item.artist}</Text>
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
