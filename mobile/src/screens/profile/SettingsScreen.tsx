// mobile/src/screens/profile/SettingsScreen.tsx
// Se abre desde el login (sin sesión: solo la URL del backend) y desde el perfil (con las opciones de cuenta)
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import KeyboardScrollView from '../../components/KeyboardScrollView';
import { useAuth } from '../../state/auth';
import { useSettings } from '../../state/settings';

type Check = { state: 'idle' } | { state: 'checking' } | { state: 'ok' } | { state: 'error'; message: string };

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { backendUrl, setBackendUrl } = useSettings();
  const { token, logout, logoutAll } = useAuth();
  const [url, setUrl] = useState(backendUrl);
  const [saved, setSaved] = useState(false);
  const [check, setCheck] = useState<Check>({ state: 'idle' });

  const cleanUrl = () => url.trim().replace(/\/+$/, '');

  const handleSave = async () => {
    await setBackendUrl(cleanUrl());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Comprueba que en esa URL responde el backend antes de guardarla
  const handleTest = async () => {
    setCheck({ state: 'checking' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${cleanUrl()}/`, { signal: controller.signal });
      setCheck(res.ok ? { state: 'ok' } : { state: 'error', message: `El servidor respondió ${res.status}` });
    } catch {
      setCheck({ state: 'error', message: 'No responde. ¿Está el backend arrancado y en la misma wifi?' });
    } finally {
      clearTimeout(timer);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  const handleLogoutAll = () => {
    Alert.alert(
      'Cerrar sesión en todos los dispositivos',
      'Se cerrará la sesión en este móvil y en cualquier otro donde hayas entrado con tu cuenta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar todas',
          style: 'destructive',
          onPress: () => logoutAll().catch((e) => Alert.alert('No se pudo cerrar', e.message)),
        },
      ],
    );
  };

  return (
    <KeyboardScrollView style={s.screen} contentContainerStyle={s.container}>
      <Text style={s.label}>URL del backend</Text>
      <Text style={s.hint}>Cambia esto para apuntar a otro servidor durante las pruebas.</Text>
      <TextInput style={s.input} value={url} onChangeText={(v) => { setUrl(v); setCheck({ state: 'idle' }); }}
        autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.10:3000"
        placeholderTextColor="#555" />

      {check.state === 'ok' ? <Text style={s.ok}>✓ El backend responde</Text> : null}
      {check.state === 'error' ? <Text style={s.error}>{check.message}</Text> : null}

      <View style={s.row}>
        <TouchableOpacity style={[s.btn, s.secondaryBtn]} onPress={handleTest} disabled={check.state === 'checking'}>
          {check.state === 'checking'
            ? <ActivityIndicator color="#1db954" />
            : <Text style={s.secondaryText}>Probar conexión</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.primaryBtn]} onPress={handleSave}>
          <Text style={s.primaryText}>{saved ? '✓ Guardado' : 'Guardar URL'}</Text>
        </TouchableOpacity>
      </View>

      {token ? (
        <>
          <Text style={[s.label, { marginTop: 40 }]}>Cuenta</Text>
          <TouchableOpacity style={s.item} onPress={() => navigation.navigate('ChangePassword')}>
            <Ionicons name="key-outline" size={20} color="#ccc" />
            <Text style={s.itemText}>Cambiar contraseña</Text>
            <Ionicons name="chevron-forward" size={18} color="#555" />
          </TouchableOpacity>
          <TouchableOpacity style={s.item} onPress={handleLogoutAll}>
            <Ionicons name="phone-portrait-outline" size={20} color="#ccc" />
            <Text style={s.itemText}>Cerrar sesión en todos los dispositivos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </KeyboardScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  container: { flexGrow: 1, backgroundColor: '#121212', padding: 24 },
  label: { color: '#888', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6, marginTop: 20 },
  hint: { color: '#555', fontSize: 13, marginBottom: 10 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryBtn: { backgroundColor: '#1db954' },
  primaryText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  secondaryBtn: { borderWidth: 1, borderColor: '#1db954' },
  secondaryText: { color: '#1db954', fontWeight: 'bold', fontSize: 15 },
  ok: { color: '#1db954', marginTop: 8 },
  error: { color: '#e74c3c', marginTop: 8 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e1e1e',
    borderRadius: 8, padding: 14, marginTop: 8,
  },
  itemText: { color: '#fff', fontSize: 15, flex: 1 },
  logoutBtn: { marginTop: 32, borderRadius: 8, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e74c3c' },
  logoutText: { color: '#e74c3c', fontWeight: 'bold', fontSize: 15 },
});
