import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../state/auth';
import { EventsStackParams } from '../../navigation';

interface MusicEvent {
  id: string;
  ownerId: string;
  name: string;
  isPublic: boolean;
  license: 'open' | 'invited' | 'geo';
  isActive: boolean;
  createdAt: string;
}

type Props = NativeStackScreenProps<EventsStackParams, 'EventsList'>;

export default function EventsListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [events, setEvents] = useState<MusicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<MusicEvent[]>('/events');
      setEvents(data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiFetch('/events', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), isPublic: newPublic, license: 'open' }),
      });
      setShowCreate(false);
      setNewName('');
      load();
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    Alert.alert('Eliminar evento', '¿Seguro que quieres eliminar este evento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await apiFetch(`/events/${id}`, { method: 'DELETE' });
            load();
          } catch (e: any) {
            Alert.alert('Error', 'No se pudo eliminar el evento');
          }
        },
      },
    ]);
  };

  const myEvents = events.filter(e => e.ownerId === user?.id);
  const publicEvents = events.filter(e => e.ownerId !== user?.id);

  if (loading) return <View style={s.center}><ActivityIndicator color="#1db954" /></View>;

  return (
    <View style={s.container}>
      <FlatList
        data={[
          { key: 'myHeader', type: 'header', label: 'Mis eventos' },
          ...myEvents.map(e => ({ key: e.id, type: 'event', event: e })),
          { key: 'pubHeader', type: 'header', label: 'Eventos públicos' },
          ...publicEvents.map(e => ({ key: e.id, type: 'event', event: e })),
        ] as any[]}
        keyExtractor={item => item.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1db954" />}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <Text style={s.sectionHeader}>{item.label}</Text>;
          }
          const ev: MusicEvent = item.event;
          return (
            <View style={s.cardRow}>
              <TouchableOpacity style={s.card} onPress={() => navigation.navigate('EventDetail', { eventId: ev.id, eventName: ev.name })}>
                <Text style={s.eventName}>{ev.name}</Text>
                <Text style={s.eventMeta}>{ev.isPublic ? '🌍 Público' : '🔒 Privado'} · {ev.license}</Text>
              </TouchableOpacity>
              {ev.ownerId === user?.id && (
                <TouchableOpacity onPress={() => handleDeleteEvent(ev.id)} style={{ padding: 6, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>🗑</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Nuevo evento</Text>
            <TextInput style={s.input} placeholder="Nombre del evento" placeholderTextColor="#888"
              value={newName} onChangeText={setNewName} />
            <View style={s.row}>
              <Text style={s.label}>Público</Text>
              <Switch value={newPublic} onValueChange={setNewPublic} trackColor={{ true: '#1db954' }} />
            </View>
            <TouchableOpacity style={s.createBtn} onPress={handleCreate} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.createBtnText}>Crear</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={s.cancel}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  sectionHeader: { color: '#888', fontSize: 12, fontWeight: 'bold', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, textTransform: 'uppercase' },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8 },
  card: { flex: 1, backgroundColor: '#1e1e1e', padding: 16, borderRadius: 10 },
  eventName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  eventMeta: { color: '#888', fontSize: 13, marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#1db954', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: { backgroundColor: '#282828', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  label: { color: '#fff', fontSize: 15 },
  createBtn: { backgroundColor: '#1db954', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 10 },
  createBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancel: { color: '#888', textAlign: 'center', fontSize: 14 },
});
