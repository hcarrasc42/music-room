// mobile/src/components/KeyboardScrollView.tsx
// ScrollView que se aparta del teclado, para que no tape los campos de abajo
import { useHeaderHeight } from '@react-navigation/elements';
import { KeyboardAvoidingView, Platform, ScrollView, ScrollViewProps } from 'react-native';

export default function KeyboardScrollView(props: ScrollViewProps) {
  const headerHeight = useHeaderHeight();

  // En iOS el propio ScrollView ajusta su margen y hace scroll hasta el campo enfocado
  const scroll = <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets {...props} />;
  if (Platform.OS === 'ios') return scroll;

  // En Android (edge-to-edge) la ventana no se encoge sola: hay que dejar hueco al teclado
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
      {scroll}
    </KeyboardAvoidingView>
  );
}
