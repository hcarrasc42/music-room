import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from './src/state/auth';
import RootNavigator from './src/navigation';

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#121212',
    card: '#121212',
    text: '#ffffff',
    border: '#222222',
    primary: '#1db954',
    notification: '#1db954',
  },
};

export default function App() {
  const hydrate = useAuth(s => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <NavigationContainer theme={AppTheme}>
      <StatusBar style="light" />
      <RootNavigator />
    </NavigationContainer>
  );
}
