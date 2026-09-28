import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';

interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted';
}

interface UserResult {
  id: string;
  email: string;
}

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<UserResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [addingId, setAddingId] = useState('');

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([
        apiFetch<Friendship[]>('/friends'),
        apiFetch<Friendship[]>('/friends/requests'),
      ]);
      setFriends(f ?? []);
      setRequests(r ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const results = await apiFetch<UserResult[]>(`/users/search?q=${encodeURIComponent(searchEmail.trim())}`);
      setSearchResult(results?.[0] ?? null);
      if (!results?.length) setSearchError('Usuario no encontrado');
    } catch {
      setSearchError('Error al buscar');
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (email: string) => {
    setAddingId(email);
    try {
      await apiFetch('/friends', { method: 'POST', body: JSON.stringify({ email }) });
      setSearchResult(null);
      setSearchEmail('');
      load();
    } catch (e: any) {
      setSearchError(e.message ?? 'Error al enviar solicitud');
    } finally {
      setAddingId('');
    }
  };

  const handleAccept = async (id: string) => {
    await apiFetch(`/friends/${id}/accept`, { method: 'PUT' });
    load();
  };

  const handleRemove = async (id: string) => {
    await apiFetch(`/friends/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#1db954" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>

      <Text style={s.section}>Buscar usuario</Text>
      <View style={s.row}>
        <TextInput style={[s.input, { flex: 1 }]} placeholder="Email del usuario" placeholderTextColor="#888"
          value={searchEmail} onChangeText={setSearchEmail} autoCapitalize="none" keyboardType="email-address" />
        <TouchableOpacity style={s.searchBtn} onPress={handleSearch} disabled={searching}>
          {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.searchBtnText}>Buscar</Text>}
        </TouchableOpacity>
      </View>
      {searchError ? <Text style={s.error}>{searchError}</Text> : null}
      {searchResult && (
        <View style={s.card}>
          <Text style={s.cardText}>{searchResult.email}</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => handleAdd(searchResult.email)} disabled={!!addingId}>
            <Text style={s.addBtnText}>+ Añadir</Text>
          </TouchableOpacity>
        </View>
      )}

      {requests.length > 0 && (
        <>
          <Text style={s.section}>Solicitudes pendientes</Text>
          {requests.map(r => (
            <View key={r.id} style={s.card}>
              <Text style={s.cardText}>{r.userId}</Text>
              <View style={s.actions}>
                <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(r.id)}>
                  <Text style={s.acceptText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={() => handleRemove(r.id)}>
                  <Text style={s.rejectText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={s.section}>Mis amigos</Text>
      {friends.length === 0 && <Text style={s.empty}>Aún no tienes amigos.</Text>}
      {friends.map(f => (
        <View key={f.id} style={s.card}>
          <Text style={s.cardText}>{f.friendId}</Text>
          <TouchableOpacity onPress={() => handleRemove(f.id)}>
            <Text style={s.removeText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      ))}

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  section: { color: '#888', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, marginTop: 20 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#333' },
  searchBtn: { backgroundColor: '#1db954', borderRadius: 8, padding: 12, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: 'bold' },
  card: { backgroundColor: '#1e1e1e', borderRadius: 8, padding: 14, marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardText: { color: '#fff', fontSize: 14 },
  addBtn: { backgroundColor: '#1db954', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: '#1db954', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText: { color: '#fff', fontWeight: 'bold' },
  rejectBtn: { backgroundColor: '#333', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  rejectText: { color: '#aaa', fontWeight: 'bold' },
  removeText: { color: '#e74c3c', fontSize: 13 },
  error: { color: '#e74c3c', fontSize: 13, marginBottom: 8 },
  empty: { color: '#555', fontSize: 14 },
});
