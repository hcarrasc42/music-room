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
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const data = await apiFetch<MusicEvent[]>('/events');
      setAllEvents(data ?? []);
    } catch {
      setLoadError('No se pudieron cargar los eventos');
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
      {loadError ? (
        <View style={s.errorContainer}>
          <Text style={s.errorText}>{loadError}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load}>
            <Text style={s.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <FlatList
        data={filtered}
        keyExtractor={e => e.id}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={s.empty}>No hay eventos que coincidan.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('EventDetail', { eventId: item.id, eventName: item.name, ownerId: item.ownerId })}
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
  errorContainer: { alignItems: 'center', padding: 20 },
  errorText: { color: '#e74c3c', fontSize: 14, marginBottom: 12 },
  retryBtn: { backgroundColor: '#1db954', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: 'bold' },
});
