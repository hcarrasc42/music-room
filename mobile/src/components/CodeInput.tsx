// mobile/src/components/CodeInput.tsx
import { StyleSheet, TextInput } from 'react-native';

// Campo para el código de 6 dígitos que llega por email.
// oneTimeCode / one-time-code permiten que iOS y Android lo sugieran solos.
export default function CodeInput({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <TextInput
      style={s.input}
      value={value}
      onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
      placeholder="000000"
      placeholderTextColor="#444"
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={6}
    />
  );
}

const s = StyleSheet.create({
  input: {
    backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8, padding: 14, marginBottom: 12,
    fontSize: 28, letterSpacing: 10, textAlign: 'center', fontWeight: 'bold', borderWidth: 1, borderColor: '#333',
  },
});
