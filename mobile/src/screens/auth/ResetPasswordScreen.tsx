// mobile/src/screens/auth/ResetPasswordScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import KeyboardScrollView from '../../components/KeyboardScrollView';
import { apiFetch } from '../../api/client';
import { AuthStackParams } from '../../navigation';

type Props = NativeStackScreenProps<AuthStackParams, 'ResetPassword'>;

export default function ResetPasswordScreen({ route, navigation }: Props) {
  const { email } = route.params;
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (!token.trim()) { setError('Pega el código que te hemos enviado'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    setError('');
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim(), password }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message === 'Invalid or expired token' ? 'El código no es válido o ha caducado (dura 1 hora)' : e.message ?? 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <KeyboardScrollView style={s.screen} contentContainerStyle={s.container}>
        <Text style={s.title}>Contraseña cambiada</Text>
        <Text style={s.body}>Ya puedes iniciar sesión con tu nueva contraseña.</Text>
        <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Login')}>
          <Text style={s.btnText}>Ir al login</Text>
        </TouchableOpacity>
      </KeyboardScrollView>
    );
  }

  return (
    <KeyboardScrollView style={s.screen} contentContainerStyle={s.container}>
      <Text style={s.title}>Nueva contraseña</Text>
      <Text style={s.body}>
        Hemos enviado un código a <Text style={s.email}>{email}</Text>. Pégalo aquí y elige tu nueva contraseña.
      </Text>
      <TextInput style={s.input} placeholder="Código" placeholderTextColor="#888"
        value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />
      {/* textContentType="oneTimeCode" evita que iOS proponga una contraseña inventada */}
      <TextInput style={s.input} placeholder="Nueva contraseña (mín. 8 caracteres)" placeholderTextColor="#888"
        value={password} onChangeText={setPassword} secureTextEntry textContentType="oneTimeCode" />
      <TextInput style={s.input} placeholder="Repite la contraseña" placeholderTextColor="#888"
        value={confirm} onChangeText={setConfirm} secureTextEntry textContentType="oneTimeCode" />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={s.btn} onPress={handleReset} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Cambiar contraseña</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={s.link}>Volver al login</Text>
      </TouchableOpacity>
    </KeyboardScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  container: { flexGrow: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  body: { color: '#aaa', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  email: { color: '#1db954', fontWeight: 'bold' },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1db954', textAlign: 'center', marginTop: 16, fontSize: 14 },
  error: { color: '#e74c3c', textAlign: 'center', marginBottom: 8 },
});
