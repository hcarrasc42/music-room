// mobile/src/screens/auth/LoginScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';
import KeyboardScrollView from '../../components/KeyboardScrollView';
import { useAuth } from '../../state/auth';
import { AuthStackParams } from '../../navigation';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
// Mensaje exacto que devuelve el backend (auth.service.ts → login)
const UNVERIFIED_MESSAGE = 'Tienes que verificar tu email antes de entrar';

// Separate component so the hook is always called unconditionally within it.
// LoginScreen only renders this when GOOGLE_CLIENT_ID is set, avoiding the
// "iosClientId must be defined" crash on iOS when Google auth isn't configured.
function GoogleLoginButton({ onToken, disabled }: { onToken: (t: string) => void; disabled: boolean }) {
  const [, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CLIENT_ID,
    iosClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token;
      if (idToken) onToken(idToken);
    }
  }, [response, onToken]);

  return (
    <TouchableOpacity style={s.googleBtn} onPress={() => promptAsync()} disabled={disabled}>
      <Text style={s.googleText}>G  Continuar con Google</Text>
    </TouchableOpacity>
  );
}

type Props = NativeStackScreenProps<AuthStackParams, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginGoogle } = useAuth();
  const insets = useSafeAreaInsets();

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
      if (e.message === UNVERIFIED_MESSAGE) {
        // Cuenta sin verificar: se manda un código nuevo y se pasa a la pantalla de verificación
        const cleanEmail = email.trim().toLowerCase();
        await apiFetch('/auth/resend-verification', {
          method: 'POST',
          body: JSON.stringify({ email: cleanEmail }),
        }).catch(() => undefined);
        navigation.navigate('VerifyEmail', { email: cleanEmail });
        return;
      }
      setError(e.message ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.screen}>
      <KeyboardScrollView style={s.screen} contentContainerStyle={s.container}>
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

        {GOOGLE_CLIENT_ID ? (
          <>
            <Text style={s.divider}>— o continuar con —</Text>
            <GoogleLoginButton onToken={handleGoogleToken} disabled={loading} />
          </>
        ) : null}

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={s.link}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={s.link}>¿No tienes cuenta? Regístrate</Text>
        </TouchableOpacity>
      </KeyboardScrollView>
      {/* Ajustes antes de entrar: si la URL del backend está mal no se podría ni iniciar sesión */}
      <TouchableOpacity style={[s.settingsBtn, { top: insets.top + 8 }]} onPress={() => navigation.navigate('Settings')}
        accessibilityLabel="Ajustes del servidor" hitSlop={12}>
        <Ionicons name="settings-outline" size={24} color="#888" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  settingsBtn: { position: 'absolute', right: 16, padding: 4 },
  container: { flexGrow: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center' },
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
