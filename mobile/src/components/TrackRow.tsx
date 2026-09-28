// mobile/src/components/TrackRow.tsx
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  id: string;
  trackName: string;
  artist: string;
  albumArt: string | null;
  votes: number;
  userVoted: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
}

export default function TrackRow({ id, trackName, artist, albumArt, votes, userVoted, onVote, onUnvote, canDelete, onDelete }: Props) {
  return (
    <View style={s.row}>
      {albumArt ? (
        <Image source={{ uri: albumArt }} style={s.art} />
      ) : (
        <View style={[s.art, s.artPlaceholder]} />
      )}
      <View style={s.info}>
        <Text style={s.track} numberOfLines={1}>{trackName}</Text>
        <Text style={s.artist} numberOfLines={1}>{artist}</Text>
      </View>
      <TouchableOpacity
        style={[s.voteBtn, userVoted && s.votedBtn]}
        onPress={() => userVoted ? onUnvote(id) : onVote(id)}
      >
        <Text style={[s.voteText, userVoted && s.votedText]}>▲ {votes}</Text>
      </TouchableOpacity>
      {canDelete && onDelete && (
        <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(id)}>
          <Ionicons name="trash-outline" size={18} color="#e74c3c" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, backgroundColor: '#1e1e1e', borderRadius: 8, marginBottom: 6 },
  art: { width: 44, height: 44, borderRadius: 4 },
  artPlaceholder: { backgroundColor: '#333' },
  info: { flex: 1 },
  track: { color: '#fff', fontSize: 14, fontWeight: '600' },
  artist: { color: '#888', fontSize: 12, marginTop: 2 },
  voteBtn: { backgroundColor: '#333', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  votedBtn: { backgroundColor: '#1db954' },
  voteText: { color: '#aaa', fontSize: 13, fontWeight: 'bold' },
  votedText: { color: '#fff' },
  deleteBtn: { padding: 6 },
});
