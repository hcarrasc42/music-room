// mobile/src/components/NowPlayingBar.tsx
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  trackName: string | null;
  artist: string | null;
}

export default function NowPlayingBar({ trackName, artist }: Props) {
  if (!trackName) return null;
  return (
    <View style={s.bar}>
      <Text style={s.icon}>▶</Text>
      <View style={s.info}>
        <Text style={s.track} numberOfLines={1}>{trackName}</Text>
        <Text style={s.artist} numberOfLines={1}>{artist}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: '#1db954', flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  icon: { color: '#fff', fontSize: 18 },
  info: { flex: 1 },
  track: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  artist: { color: '#d4f5de', fontSize: 12 },
});
