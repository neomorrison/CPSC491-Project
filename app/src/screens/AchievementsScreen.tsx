import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  errorMessage,
  fetchChallenges,
} from '../lib/challenges';
import type { ChallengeData } from '../lib/challenges';

type Props = {
  onBack: () => void;
};

export default function AchievementsScreen({ onBack }: Props) {
  const [data, setData] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    fetchChallenges()
      .then(result => {
        if (active) setData(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reload]);

  return (
    <View style={styles.screen}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={styles.button}
      >
        <Text style={styles.body}>← Back</Text>
      </Pressable>

      <Text style={styles.eyebrow}>Badge Collection</Text>
      <Text style={styles.title}>Achievements</Text>

      {loading ? (
        <ActivityIndicator color="#006868" />
      ) : error ? (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            onPress={() => setReload(value => value + 1)}
          >
            <Text style={styles.body}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.grid}>
          {data?.medals.map(medal => {
            const earned = data.earnedMedals.find(
              item => item.achievement_id === medal.id
            );

            return (
              <View key={medal.id} style={styles.card}>
                <View style={styles.artwork} />

                <Text style={styles.name}>{medal.name}</Text>

                {!!medal.description && (
                  <Text style={styles.body}>
                    {medal.description}
                  </Text>
                )}

                <Text style={styles.status}>
                  {earned ? 'Earned' : 'Not earned yet'}
                </Text>
              </View>
            );
          })}

          {data?.medals.length === 0 && (
            <Text style={styles.body}>
              No medals have been added yet.
            </Text>
          )}

          <View style={styles.comingSoon}>
            <Text style={styles.name}>More Coming Soon…</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { 
    gap: 12, 
    paddingBottom: 24, 
},
  button: { 
    minHeight: 44, 
    alignSelf: 'flex-start', 
    justifyContent: 'center', 
},
  eyebrow: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    letterSpacing: 1,
    color: '#111111',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: '#494949',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 18, 
    rowGap: 12,
  },
  card: {
    width: '48%',
    minHeight: 132,
    paddingHorizontal: 8,
    paddingVertical: 12, 
    borderRadius: 16,
    backgroundColor: '#FFC29E',
    alignItems: 'center',
    gap: 5,
  },
  artwork: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  name: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#494949',
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 14, 
    color: '#494949',
    textAlign: 'center',
  },
  status: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: '#494949',
  },
  comingSoon: {
    width: '48%',
    minHeight: 132,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'flex-end',
  },
  error: { fontSize: 12, color: '#A32929' },
});