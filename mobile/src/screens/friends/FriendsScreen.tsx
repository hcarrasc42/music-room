import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';

interface UserSummary {
  id: string;
  username: string;
  displayName: string | null;
}

interface Friendship {
  id: string;
  status: 'pending' | 'accepted';
  user: UserSummary;
}

// Nombre de display grande y @usuario debajo; sin nombre de display, solo @usuario
function UserName({ user }: { user: UserSummary }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.cardText}>{user.displayName || `@${user.username}`}</Text>
      {user.displayName ? <Text style={s.cardSub}>@{user.username}</Text> : null}
    </View>
  );
}

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [addingId, setAddingId] = useState('');
  const [actionError, setActionError] = useState('');

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
    const q = query.trim().replace(/^@/, '');
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const found = await apiFetch<UserSummary[]>(`/users/search?q=${encodeURIComponent(q)}`);
      setResults(found ?? []);
      if (!found?.length) setSearchError('Usuario no encontrado');
    } catch {
      setSearchError('Error al buscar');
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (userId: string) => {
    setAddingId(userId);
    setSearchError('');
    try {
      await apiFetch('/friends', { method: 'POST', body: JSON.stringify({ userId }) });
      setResults([]);
      setQuery('');
      load();
    } catch (e: any) {
      setSearchError(e.message ?? 'Error al enviar solicitud');
    } finally {
      setAddingId('');
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await apiFetch(`/friends/${id}/accept`, { method: 'PUT' });
      load();
    } catch {
      setActionError('No se pudo aceptar la solicitud');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await apiFetch(`/friends/${id}`, { method: 'DELETE' });
      load();
    } catch {
      setActionError('No se pudo completar la acción');
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#1db954" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">

      <Text style={s.section}>Buscar usuario</Text>
      <View style={s.row}>
        <TextInput style={[s.input, { flex: 1 }]} placeholder="Nombre de usuario" placeholderTextColor="#888"
          value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false}
          returnKeyType="search" onSubmitEditing={handleSearch} />
        <TouchableOpacity style={s.searchBtn} onPress={handleSearch} disabled={searching}>
          {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.searchBtnText}>Buscar</Text>}
        </TouchableOpacity>
      </View>
      {searchError ? <Text style={s.error}>{searchError}</Text> : null}
      {results.map(u => (
        <View key={u.id} style={s.card}>
          <UserName user={u} />
          <TouchableOpacity style={s.addBtn} onPress={() => handleAdd(u.id)} disabled={!!addingId}>
            {addingId === u.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.addBtnText}>+ Añadir</Text>}
          </TouchableOpacity>
        </View>
      ))}

      {requests.length > 0 && (
        <>
          <Text style={s.section}>Solicitudes pendientes</Text>
          {requests.map(r => (
            <View key={r.id} style={s.card}>
              <UserName user={r.user} />
              <View style={s.actions}>
                <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(r.id)}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={() => handleRemove(r.id)}>
                  <Ionicons name="close" size={16} color="#aaa" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {actionError ? <Text style={s.error}>{actionError}</Text> : null}

      <Text style={s.section}>Mis amigos</Text>
      {friends.length === 0 && <Text style={s.empty}>Aún no tienes amigos.</Text>}
      {friends.map(f => (
        <View key={f.id} style={s.card}>
          <UserName user={f.user} />
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
  card: { backgroundColor: '#1e1e1e', borderRadius: 8, padding: 14, marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardText: { color: '#fff', fontSize: 15 },
  cardSub: { color: '#888', fontSize: 12, marginTop: 2 },
  addBtn: { backgroundColor: '#1db954', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: '#1db954', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  rejectBtn: { backgroundColor: '#333', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  removeText: { color: '#e74c3c', fontSize: 13 },
  error: { color: '#e74c3c', fontSize: 13, marginBottom: 8 },
  empty: { color: '#555', fontSize: 14 },
});
