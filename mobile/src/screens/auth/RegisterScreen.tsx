// mobile/src/screens/auth/RegisterScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import KeyboardScrollView from '../../components/KeyboardScrollView';
import { apiFetch } from '../../api/client';
import { AuthStackParams } from '../../navigation';
import { checkEmail, EmailCheck } from '../../utils/emailCheck';

type Props = NativeStackScreenProps<AuthStackParams, 'Register'>;

// Mismas reglas que backend/src/common/validation/username.ts
const USERNAME_REGEX = /^(?!\.)(?!.*\.$)[a-z0-9_.]{3,20}$/;

export default function RegisterScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailCheck, setEmailCheck] = useState<EmailCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailCheck(null); // el aviso vuelve a salir al terminar de escribir
  };

  const acceptSuggestion = (suggestion: string) => {
    setEmail(suggestion);
    setEmailCheck({ ok: true });
  };

  const handleRegister = async () => {
    const check = checkEmail(email);
    setEmailCheck(check);
    if (!USERNAME_REGEX.test(username)) {
      setError('El nombre de usuario debe tener 3-20 caracteres: letras, números, _ y . (sin empezar ni acabar en punto)');
      return;
    }
    if (!check.ok) { setError(''); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }

    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    setError('');
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email: cleanEmail, password }),
      });
      navigation.navigate('VerifyEmail', { email: cleanEmail });
    } catch (e: any) {
      setError(Array.isArray(e.message) ? e.message.join('\n') : e.message ?? 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardScrollView style={s.screen} contentContainerStyle={s.container}>
      <Text style={s.title}>Crear cuenta</Text>

      <TextInput style={s.input} placeholder="Nombre de usuario" placeholderTextColor="#888"
        value={username} onChangeText={v => setUsername(v.toLowerCase().replace(/\s/g, ''))}
        autoCapitalize="none" autoCorrect={false} maxLength={20} />
      <Text style={s.hint}>Así te encontrarán tus amigos. Letras, números, _ y .</Text>

      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#888"
        value={email} onChangeText={handleEmailChange} onBlur={() => email.trim() && setEmailCheck(checkEmail(email))}
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
      {emailCheck && !emailCheck.ok && (
        emailCheck.suggestion ? (
          <TouchableOpacity onPress={() => acceptSuggestion(emailCheck.suggestion!)}>
            <Text style={s.warning}>
              ¿Quisiste decir <Text style={s.suggestion}>{emailCheck.suggestion}</Text>? Toca para corregirlo.
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={s.warning}>{emailCheck.error}</Text>
        )
      )}

      <TextInput style={s.input} placeholder="Contraseña (mín. 8 caracteres)" placeholderTextColor="#888"
        value={password} onChangeText={setPassword} secureTextEntry
        // Evita que iOS rellene una "contraseña segura" inventada que luego no recuerdas
        textContentType="oneTimeCode" />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Crear cuenta</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={s.link}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </KeyboardScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  container: { flexGrow: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  hint: { color: '#666', fontSize: 12, marginTop: -6, marginBottom: 12 },
  warning: { color: '#f1c40f', fontSize: 13, marginTop: -6, marginBottom: 12 },
  suggestion: { fontWeight: 'bold', textDecorationLine: 'underline' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1db954', textAlign: 'center', marginTop: 16, fontSize: 14 },
  error: { color: '#e74c3c', textAlign: 'center', marginBottom: 8 },
});
