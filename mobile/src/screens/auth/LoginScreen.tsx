// mobile/src/screens/auth/LoginScreen.tsx
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { AuthStackParams } from '../../navigation';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

type Props = NativeStackScreenProps<AuthStackParams, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginGoogle } = useAuth();

  const [, response, promptAsync] = Google.useAuthRequest({ webClientId: GOOGLE_CLIENT_ID });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token;
      if (idToken) handleGoogleToken(idToken);
    }
  }, [response]);

  const handleGoogleToken = async (idToken: string) => {
    setLoading(true);
    setError('');
    try {
      await loginGoogle(idToken);
    } catch (e: any) {
      setError(e.message ?? 'Error con Google');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError('Completa todos los campos'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.message ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>🎵 Music Room</Text>
      <Text style={s.subtitle}>Music, Collaboration &amp; Mobility</Text>

      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#888"
        value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={s.input} placeholder="Contraseña" placeholderTextColor="#888"
        value={password} onChangeText={setPassword} secureTextEntry />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Iniciar sesión</Text>}
      </TouchableOpacity>

      <Text style={s.divider}>— o continuar con —</Text>

      <TouchableOpacity style={s.googleBtn} onPress={() => promptAsync()} disabled={loading || !GOOGLE_CLIENT_ID}>
        <Text style={s.googleText}>G  Continuar con Google</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={s.link}>¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={s.link}>¿No tienes cuenta? Regístrate</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  divider: { color: '#555', textAlign: 'center', marginVertical: 16 },
  googleBtn: { backgroundColor: '#fff', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 16 },
  googleText: { color: '#333', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1db954', textAlign: 'center', marginTop: 12, fontSize: 14 },
  error: { color: '#e74c3c', textAlign: 'center', marginBottom: 8 },
});
