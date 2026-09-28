// mobile/src/screens/profile/SettingsScreen.tsx
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useSettings } from '../../state/settings';

export default function SettingsScreen() {
  const { backendUrl, setBackendUrl } = useSettings();
  const { logout } = useAuth();
  const [url, setUrl] = useState(backendUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await setBackendUrl(url.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={s.container}>
      <Text style={s.label}>URL del backend</Text>
      <Text style={s.hint}>Cambia esto para apuntar a otro servidor durante las pruebas.</Text>
      <TextInput style={s.input} value={url} onChangeText={setUrl}
        autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
        <Text style={s.saveBtnText}>{saved ? '✓ Guardado' : 'Guardar URL'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24 },
  label: { color: '#888', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6, marginTop: 20 },
  hint: { color: '#555', fontSize: 13, marginBottom: 10 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  saveBtn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  logoutBtn: { marginTop: 48, borderRadius: 8, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e74c3c' },
  logoutText: { color: '#e74c3c', fontWeight: 'bold', fontSize: 15 },
});
