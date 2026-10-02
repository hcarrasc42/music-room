// mobile/src/screens/profile/ChangePasswordScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { apiFetch } from '../../api/client';
import KeyboardScrollView from '../../components/KeyboardScrollView';
import { ProfileStackParams } from '../../navigation';
import { useAuth } from '../../state/auth';

type Props = NativeStackScreenProps<ProfileStackParams, 'ChangePassword'>;

export default function ChangePasswordScreen({ navigation }: Props) {
  const { changePassword } = useAuth();
  // Las cuentas creadas con Google no tienen contraseña: se crea sin pedir la actual
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    apiFetch<{ hasPassword: boolean }>('/users/me')
      .then((me) => setHasPassword(me.hasPassword))
      .catch(() => setHasPassword(true));
  }, []);

  const handleSave = async () => {
    if (hasPassword && !current) { setError('Escribe tu contraseña actual'); return; }
    if (password.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    setError('');
    try {
      await changePassword(hasPassword ? current : undefined, password);
      setDone(true);
    } catch (e: any) {
      setError(e.message ?? 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (hasPassword === null) {
    return <ActivityIndicator style={s.screen} color="#1db954" />;
  }

  if (done) {
    return (
      <KeyboardScrollView style={s.screen} contentContainerStyle={s.container}>
        <Text style={s.title}>{hasPassword ? 'Contraseña cambiada' : 'Contraseña creada'}</Text>
        <Text style={s.body}>Por seguridad, hemos cerrado la sesión en tus otros dispositivos.</Text>
        <TouchableOpacity style={s.btn} onPress={() => navigation.goBack()}>
          <Text style={s.btnText}>Volver</Text>
        </TouchableOpacity>
      </KeyboardScrollView>
    );
  }

  return (
    <KeyboardScrollView style={s.screen} contentContainerStyle={s.container}>
      {!hasPassword ? (
        <Text style={s.body}>Tu cuenta no tiene contraseña porque entraste con Google. Crea una para poder entrar también con tu email.</Text>
      ) : null}
      {hasPassword ? (
        <TextInput style={s.input} placeholder="Contraseña actual" placeholderTextColor="#888"
          value={current} onChangeText={setCurrent} secureTextEntry textContentType="password" />
      ) : null}
      {/* textContentType="newPassword" deja que iOS proponga una contraseña segura */}
      <TextInput style={s.input} placeholder="Nueva contraseña (mín. 8 caracteres)" placeholderTextColor="#888"
        value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" />
      <TextInput style={s.input} placeholder="Repite la nueva contraseña" placeholderTextColor="#888"
        value={confirm} onChangeText={setConfirm} secureTextEntry textContentType="newPassword" />
      <Text style={s.hint}>Al cambiarla se cerrará la sesión en tus otros dispositivos.</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={s.btn} onPress={handleSave} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>{hasPassword ? 'Cambiar contraseña' : 'Crear contraseña'}</Text>}
      </TouchableOpacity>
    </KeyboardScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  container: { flexGrow: 1, backgroundColor: '#121212', padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: 40, marginBottom: 16 },
  body: { color: '#aaa', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  hint: { color: '#666', fontSize: 13, marginBottom: 12 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  error: { color: '#e74c3c', textAlign: 'center', marginBottom: 8 },
});
