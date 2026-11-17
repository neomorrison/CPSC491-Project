
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';


type ProgressScreenProps = {
    totalXp: number;
    level: number;
    xpIntoLevel: number;
    xpForNextLevel: number;
  };
  
  export default function ProgressScreen({
    totalXp,
    level,
    xpIntoLevel,
    xpForNextLevel,
  }: ProgressScreenProps) {
    return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Progress</Text>

      <Text style={styles.subtitle}>
        Keep going! Every workout counts.
      </Text>

<View style={styles.xpCard}>
  <Text style={styles.levelText}>
    Level {level}
  </Text>

  <Text style={styles.xpText}>
    {totalXp} Total XP
  </Text>

  <View style={styles.progressTrack}>
    <View
      style={[
        styles.progressFill,
        {
          width: `${
            xpForNextLevel > 0
              ? Math.min(100, Math.max(0,
                  (xpIntoLevel / xpForNextLevel) * 100))
              : 0
          }%`,
        },
      ]}
    />
  </View>

  
<Text style={styles.subtitle}>
  {xpIntoLevel} of {xpForNextLevel} XP earned at Level {level}
</Text>

<Text style={styles.subtitle}>
  {Math.max(0, xpForNextLevel - xpIntoLevel)} XP remaining
  until Level {level + 1}
</Text>
</View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#203535',
  },

  subtitle: {
    fontSize: 14,
    color: '#526666',
  },

xpCard: {
    backgroundColor: '#F1F1F1',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  
  levelText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#203535',
  },
  
  xpText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#028A8A',
  },
  
  progressTrack: {
    height: 12,
    backgroundColor: '#D9E5E5',
    borderRadius: 6,
    overflow: 'hidden',
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: '#028A8A',
    borderRadius: 6,
  },  
});
