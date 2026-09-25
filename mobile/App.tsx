import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from './src/state/auth';
import RootNavigator from './src/navigation';

export default function App() {
  const hydrate = useAuth(s => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <>
      <StatusBar style="light" />
      <RootNavigator />
    </>
  );
}
