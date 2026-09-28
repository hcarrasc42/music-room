// mobile/src/screens/auth/VerifyEmailScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { AuthStackParams } from '../../navigation';

type Props = NativeStackScreenProps<AuthStackParams, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const { email, password } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleCheck = async () => {
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (e: any) {
      setError('Email todavía no verificado. Revisa tu bandeja de entrada.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.emoji}>📬</Text>
      <Text style={s.title}>Verifica tu email</Text>
      <Text style={s.body}>
        Hemos enviado un enlace de verificación a{'\n'}
        <Text style={s.email}>{email}</Text>
        {'\n\n'}Haz clic en el enlace y luego pulsa el botón de abajo.
      </Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={s.btn} onPress={handleCheck} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Ya lo verifiqué</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={s.link}>Volver al login</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  body: { color: '#aaa', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  email: { color: '#1db954', fontWeight: 'bold' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center', width: '100%' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1db954', marginTop: 16, fontSize: 14 },
  error: { color: '#e74c3c', textAlign: 'center', marginBottom: 12 },
});
