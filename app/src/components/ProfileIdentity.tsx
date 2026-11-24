import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatar, getFrame } from '../theme/profileRewards';

type Props = {
  displayName: string;
  avatarId: string;
  frameId: string;
  size?: number;
};

export default function ProfileIdentity({
  displayName,
  avatarId,
  frameId,
  size = 82,
}: Props) {
  const avatar = getAvatar(avatarId);
  const frame = getFrame(frameId);

  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase();

  return (
    <LinearGradient
      colors={frame.colors}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        padding: 4,
      }}
    >
      <View style={styles.innerBorder}>
        <LinearGradient
          colors={avatar.colors}
          style={styles.avatar}
        >
          <Text
            style={[
              styles.initials,
              {
                fontSize: size * 0.25,
                color:
                  avatar.id === 'initials'
                    ? '#FFFFFF'
                    : '#292929',
              },
            ]}
          >
            {initials || '?'}
          </Text>
        </LinearGradient>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  innerBorder: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 3,
    borderRadius: 14,
    overflow: 'hidden',
  },
  avatar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  initials: {
    fontFamily: 'Inter_500Medium',
  },
});