// mobile/src/screens/profile/ProfileScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';
import KeyboardScrollView from '../../components/KeyboardScrollView';
import { ProfileStackParams } from '../../navigation';

type Visibility = 'public' | 'friends' | 'private';

interface Profile {
  username: string;
  displayName: string | null;
  bio: string | null;
  city: string | null;
  bioVisibility: Visibility;
  musicGenres: string | null;
  favoriteArtists: string | null;
  musicVisibility: Visibility;
}

const VIS_OPTIONS: Visibility[] = ['public', 'friends', 'private'];
const VIS_LABELS: Record<Visibility, string> = { public: '🌍', friends: '👥', private: '🔒' };

type Props = NativeStackScreenProps<ProfileStackParams, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Profile>('/users/me');
      setProfile(data);
      setForm(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setSaveError('');
    // /users/me también devuelve id y email, que el backend rechaza: solo se envían los campos editables
    const body = {
      username: form.username,
      displayName: form.displayName ?? '',
      bio: form.bio ?? '',
      city: form.city ?? '',
      bioVisibility: form.bioVisibility,
      musicGenres: form.musicGenres ?? '',
      favoriteArtists: form.favoriteArtists ?? '',
      musicVisibility: form.musicVisibility,
    };
    try {
      await apiFetch('/users/me', { method: 'PUT', body: JSON.stringify(body) });
      setProfile(form);
    } catch (e: any) {
      const detail = Array.isArray(e.message) ? e.message.join(', ') : e.message;
      setSaveError(`No se pudo guardar el perfil${detail ? `: ${detail}` : ''}`);
    } finally {
      setSaving(false);
    }
  };

  const nextVisibility = (v: Visibility): Visibility => {
    const idx = VIS_OPTIONS.indexOf(v);
    return VIS_OPTIONS[(idx + 1) % VIS_OPTIONS.length];
  };

  if (loading || !form) return <View style={s.center}><ActivityIndicator color="#1db954" /></View>;

  return (
    <KeyboardScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>

      <Text style={s.label}>Nombre de usuario</Text>
      <TextInput style={s.input} value={form.username} onChangeText={v => setForm({ ...form, username: v.toLowerCase().replace(/\s/g, '') })}
        placeholder="tu_usuario" placeholderTextColor="#888" autoCapitalize="none" autoCorrect={false} maxLength={20} />
      <Text style={s.hint}>Con este nombre te buscan tus amigos. Letras, números, _ y .</Text>

      <Text style={s.label}>Nombre de display</Text>
      <TextInput style={s.input} value={form.displayName ?? ''} onChangeText={v => setForm({ ...form, displayName: v })} placeholder="Tu nombre" placeholderTextColor="#888" />

      <View style={s.row}>
        <Text style={s.label}>Bio</Text>
        <TouchableOpacity onPress={() => setForm({ ...form, bioVisibility: nextVisibility(form.bioVisibility) })}>
          <Text style={s.vis}>{VIS_LABELS[form.bioVisibility]}</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={[s.input, { height: 80 }]} value={form.bio ?? ''} onChangeText={v => setForm({ ...form, bio: v })}
        placeholder="Cuéntanos algo sobre ti" placeholderTextColor="#888" multiline />

      <Text style={s.label}>Ciudad</Text>
      <TextInput style={s.input} value={form.city ?? ''} onChangeText={v => setForm({ ...form, city: v })} placeholder="Tu ciudad" placeholderTextColor="#888" />

      <View style={s.row}>
        <Text style={s.label}>Géneros musicales</Text>
        <TouchableOpacity onPress={() => setForm({ ...form, musicVisibility: nextVisibility(form.musicVisibility) })}>
          <Text style={s.vis}>{VIS_LABELS[form.musicVisibility]}</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={s.input} value={form.musicGenres ?? ''} onChangeText={v => setForm({ ...form, musicGenres: v })}
        placeholder="Rock, Jazz, Pop..." placeholderTextColor="#888" />

      <Text style={s.label}>Artistas favoritos</Text>
      <TextInput style={s.input} value={form.favoriteArtists ?? ''} onChangeText={v => setForm({ ...form, favoriteArtists: v })}
        placeholder="The Beatles, Dua Lipa..." placeholderTextColor="#888" />

      {saveError ? <Text style={s.error}>{saveError}</Text> : null}

      <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Guardar</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={s.settingsLink} onPress={() => navigation.navigate('Settings')}>
        <Ionicons name="settings-outline" size={18} color="#888" />
        <Text style={s.settingsLinkText}>Ajustes</Text>
      </TouchableOpacity>

    </KeyboardScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  label: { color: '#888', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vis: { fontSize: 20, padding: 4 },
  hint: { color: '#666', fontSize: 12, marginTop: 6 },
  error: { color: '#e74c3c', fontSize: 13, marginTop: 8 },
  saveBtn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  settingsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20, marginBottom: 40 },
  settingsLinkText: { color: '#888', fontSize: 15 },
});
