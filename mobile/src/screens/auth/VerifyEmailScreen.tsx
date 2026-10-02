// mobile/src/screens/auth/VerifyEmailScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { apiFetch } from '../../api/client';
import CodeInput from '../../components/CodeInput';
import KeyboardScrollView from '../../components/KeyboardScrollView';
import { useAuth } from '../../state/auth';
import { AuthStackParams } from '../../navigation';

type Props = NativeStackScreenProps<AuthStackParams, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const { verifyEmail } = useAuth();

  // Al verificar, el backend devuelve la sesión y la navegación pasa sola a la app
  const handleVerify = async () => {
    if (code.length !== 6) { setError('El código son 6 dígitos'); return; }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await verifyEmail(email, code);
    } catch (e: any) {
      setError(e.message ?? 'No se pudo verificar el email');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await apiFetch('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
      setCode('');
      setInfo('Si no te llega en un minuto, revisa la carpeta de spam. Solo se envía un código por minuto.');
    } catch (e: any) {
      setError(e.message ?? 'No se pudo reenviar el código');
    }
  };

  return (
    <KeyboardScrollView style={s.screen} contentContainerStyle={s.container}>
      <Text style={s.emoji}>📬</Text>
      <Text style={s.title}>Verifica tu email</Text>
      <Text style={s.body}>
        Hemos enviado un código de 6 dígitos a{'\n'}
        <Text style={s.email}>{email}</Text>
      </Text>
      <CodeInput value={code} onChange={setCode} />
      {error ? <Text style={s.error}>{error}</Text> : null}
      {info ? <Text style={s.info}>{info}</Text> : null}
      <TouchableOpacity style={s.btn} onPress={handleVerify} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verificar</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={handleResend}>
        <Text style={s.link}>Reenviar código</Text>
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
  emoji: { fontSize: 48, marginBottom: 16, textAlign: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  body: { color: '#aaa', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  email: { color: '#1db954', fontWeight: 'bold' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1db954', textAlign: 'center', marginTop: 16, fontSize: 14 },
  error: { color: '#e74c3c', textAlign: 'center', marginBottom: 12 },
  info: { color: '#aaa', textAlign: 'center', marginBottom: 12, fontSize: 13 },
});
