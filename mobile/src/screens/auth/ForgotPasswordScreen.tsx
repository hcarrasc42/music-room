// mobile/src/screens/auth/ForgotPasswordScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../api/client';
import { AuthStackParams } from '../../navigation';

type Props = NativeStackScreenProps<AuthStackParams, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Email enviado</Text>
        <Text style={s.body}>Revisa tu bandeja de entrada y sigue el enlace para restablecer tu contraseña.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={s.link}>Volver al login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Recuperar contraseña</Text>
      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#888"
        value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TouchableOpacity style={s.btn} onPress={handleSend} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Enviar enlace</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={s.link}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 },
  body: { color: '#aaa', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  input: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#1db954', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1db954', textAlign: 'center', marginTop: 16, fontSize: 14 },
});
