// resuable Profile card base 


import type { ReactNode } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient'; 

type ProfileCardProps = {
    displayName: string;
    rank: string; 
    level: number; 

    // XP earned within the current level, not lifetime XP
    xpIntoLevel: number; 

    // XP needed to advance from the current level
    xpForNextLevel: number; 

    onEditProfile: () => void;

    // "Appearance" tab can supply the equipped avatar here 
    avatar?: ReactNode; 
}; 

export default function ProfileCard({
    displayName, 
    rank, 
    level, 
    xpIntoLevel, 
    xpForNextLevel, 
    onEditProfile, 
    avatar, 
}: ProfileCardProps) {
    const name = displayName.trim(); 

    const initials = name 
      .split(/s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase(); 

    const progress = 
    xpForNextLevel > 0 
    ? Math.max(
        0, 
        Math.min(1, xpIntoLevel / xpForNextLevel)
    )
  : 0; 

  const remainingXp = Math.max(
    0, 
    xpForNextLevel - xpIntoLevel
  ); 

  return (
    <LinearGradient
      colors={['#06C38B', '#006868']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.card}
    >
    <View style={styles.avatarFrame}>
        <View style={styles.avatarCircle}>
            {avatar ?? (
                <Text style={styles.initials}>
                    {initials || '?'}
                </Text>
            )}
        </View>
    </View>

    <View style={styles.identity}>
        <Text style={styles.name}>
            {name || 'Set your display name'}
        </Text>

        <Text style={styles.rank}>{rank}</Text>
    </View>

    <View style={styles.levelPanel}>
        <View style={styles.levelHeading}>
            <Text style={styles.level}>
                Level {level}
            </Text>

            <Text style={styles.remainingXp}>
                {remainingXp.toLocaleString()} XP to level {level + 1}
            </Text>
        </View>

        <View 
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Progress to next level"
        accessibilityValue={{
            min: 0, 
            max:100, 
            now: Math.round(progress * 100), 
        }}
        style={styles.progressTrack}
        >
            {progress > 0 && (
                <View
                style={[
                    styles.progressFill, 
                    { width: `${progress * 100}%` },
                ]}
                />
            )}
        </View>

        <View style={styles.xpLabels}>
            <Text style={styles.xpLabel}>
                {xpIntoLevel.toLocaleString()} XP
            </Text>

            <Text style={styles.xpLabel}>
                {xpForNextLevel.toLocaleString()} XP
            </Text>
        </View>
    </View>

    <Pressable
    accessibilityRole="button"
    onPress={onEditProfile}
    style={({ pressed }) => [
        styles.editButton, 
        pressed && styles.pressed,
    ]}
    >
        <Text style={styles.editButtonText}>
            Edit Profile
        </Text>
    </Pressable>
  </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 12,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 12,
  },

  avatarFrame: {
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  initials: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: '#4A4A4A',
  },

  identity: {
    alignItems: 'center',
    gap: 2,
  },

  name: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  rank: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  levelPanel: {
    width: '100%',
    padding: 10,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },

  levelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },

  level: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#FFFFFF',
  },

  remainingXp: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#FFFFFF',
  },

  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#CEFF32',
    borderWidth: 1,
    borderColor: '#09FB8B',
  },

  xpLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },

  xpLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
    color: '#FFFFFF',
  },

  editButton: {
    width: '100%',
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ABABAB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  editButtonText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#111111',
  },

  pressed: {
    opacity: 0.75,
  },
});