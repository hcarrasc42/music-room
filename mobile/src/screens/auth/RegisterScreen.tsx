// mobile/src/screens/auth/RegisterScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';
import { AuthStackParams } from '../../navigation';

type Props = NativeStackScreenProps<AuthStackParams, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!email.trim() || password.length < 8) {
      setError('Email válido y contraseña de al menos 8 caracteres');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      navigation.navigate('VerifyEmail', { email: email.trim(), password });
    } catch (e: any) {
      setError(e.message ?? 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Crear cuenta</Text>
      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#888"
        value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={s.input} placeholder="Contraseña (mín. 8 caracteres)" placeholderTextColor="#888"
        value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Crear cuenta</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={s.link}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1db954', textAlign: 'center', marginTop: 16, fontSize: 14 },
  error: { color: '#e74c3c', textAlign: 'center', marginBottom: 8 },
});
