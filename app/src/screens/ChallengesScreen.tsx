import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  challengeRequirement,
  errorMessage,
  fetchChallenges,
  joinChallenge,
} from '../lib/challenges';
import type { ChallengeData } from '../lib/challenges';

type Props = {
  onBack: () => void;
  onViewMedals: () => void;
};

export default function ChallengesScreen({
  onBack,
  onViewMedals,
}: Props) {
  const [data, setData] = useState<ChallengeData | null>(null);
  const [index, setIndex] = useState(0);
  const [medalIndex, setMedalIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const joiningRef = useRef(false);

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

  const challenges = data?.challenges ?? [];
  const currentIndex = challenges.length
    ? index % challenges.length
    : 0;
  const challenge = challenges[currentIndex];

  // The service orders enrollments newest first.
  const enrollment = data?.enrollments.find(
    item => item.challenge_id === challenge?.id
  );

  const completed = Boolean(enrollment?.completed_at);
  const enrolled = enrollment?.status === 'active' && !completed;

  const earnedMedals = data
    ? data.earnedMedals.flatMap(earned => {
        const medal = data.medals.find(
          item => item.id === earned.achievement_id
        );

        return medal ? [medal] : [];
      })
    : [];

  const currentMedalIndex = earnedMedals.length
    ? medalIndex % earnedMedals.length
    : 0;
  const medal = earnedMedals[currentMedalIndex];

  async function join() {
    if (!challenge || joiningRef.current || enrolled || completed) {
      return;
    }

    joiningRef.current = true;
    setJoining(true);
    setError('');
    setNotice('');

    try {
      await joinChallenge(challenge.id);
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      joiningRef.current = false;
      setJoining(false);
      return;
    }

    // Joining succeeded. A refresh failure must not imply it failed.
    setNotice('Challenge joined.');

    try {
      setData(await fetchChallenges());
    } catch (caught: unknown) {
      setError(
        `You joined successfully, but progress could not refresh. ${
          errorMessage(caught)
        }`
      );
    } finally {
      joiningRef.current = false;
      setJoining(false);
    }
  }

  function moveChallenge(direction: number) {
    if (!challenges.length) return;

    setIndex(
      (currentIndex + direction + challenges.length) %
        challenges.length
    );
    setError('');
    setNotice('');
  }

  function moveMedal(direction: number) {
    if (!earnedMedals.length) return;

    setMedalIndex(
      (currentMedalIndex + direction + earnedMedals.length) %
        earnedMedals.length
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Join a quest</Text>
        <Text style={styles.title}>Challenges & Medals</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#006868" />
      ) : (
        <>
          {!!error && (
            <View style={{ gap: 8 }}>
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setReload(value => value + 1)}
                style={styles.back}
              >
                <Text style={styles.body}>Refresh</Text>
              </Pressable>
            </View>
          )}

          {!!notice && (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {notice}
            </Text>
          )}

          {data && (
            <>
              <View style={styles.challengePanel}>
                <Text style={styles.panelTitle}>Challenges</Text>
                <Text style={styles.subtitle}>
                  An exciting way to stay consistent
                </Text>

                {challenge ? (
                  <>
                    <View style={styles.carousel}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Previous challenge"
                        disabled={joining || challenges.length < 2}
                        onPress={() => moveChallenge(-1)}
                        style={styles.arrowButton}
                      >
                        <Text style={styles.arrow}>←</Text>
                      </Pressable>

                      <LinearGradient
                        colors={['#FF72BE', '#FFAA75']}
                        style={styles.challengeCard}
                      >
                        <View style={styles.challengeArtwork} />

                        <Text style={styles.challengeName}>
                          {challenge.name}
                        </Text>

                        <Text style={styles.challengeDescription}>
                          {challenge.description ||
                            challengeRequirement(challenge)}
                        </Text>

                        <Text style={styles.requirement}>
                          {challengeRequirement(challenge)}
                        </Text>

                        <Text style={styles.requirement}>
                          {challenge.xp_reward} XP reward
                        </Text>
                      </LinearGradient>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Next challenge"
                        disabled={joining || challenges.length < 2}
                        onPress={() => moveChallenge(1)}
                        style={styles.arrowButton}
                      >
                        <Text style={styles.arrow}>→</Text>
                      </Pressable>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      disabled={joining || enrolled || completed}
                      onPress={join}
                      style={[
                        styles.joinButton,
                        enrolled && styles.joinedButton,
                      ]}
                    >
                      <Text style={styles.panelTitle}>
                        {joining
                          ? 'Joining…'
                          : completed
                            ? 'Completed'
                            : enrolled
                              ? 'Joined'
                              : 'Join'}
                      </Text>
                    </Pressable>

                    {enrollment && (
                      <Text style={styles.progress}>
                        {enrollment.progress} / {challenge.target}
                        {'\n'}
                        {completed
                          ? 'Challenge completed'
                          : `Status: ${enrollment.status}`}
                        {'\n'}
                        {enrollment.start_date} → {enrollment.end_date}
                      </Text>
                    )}

                    <Text style={styles.progress}>
                      Level {challenge.min_level}+ • {challenge.difficulty}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.body}>
                    No challenges are available yet.
                  </Text>
                )}
              </View>

              {!!challenges.length && (
                <Text style={styles.position}>
                  {currentIndex + 1} / {challenges.length}
                </Text>
              )}

              <View style={styles.medalHeading}>
                <Text style={styles.sectionTitle}>Medals</Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={onViewMedals}
                  style={styles.back}
                >
                  <Text style={styles.body}>View all →</Text>
                </Pressable>
              </View>

              <View style={styles.carousel}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous medal"
                  disabled={earnedMedals.length < 2}
                  onPress={() => moveMedal(-1)}
                  style={styles.arrowButton}
                >
                  <Text style={styles.arrow}>←</Text>
                </Pressable>

                <View style={styles.medalCard}>
                  <LinearGradient
                    colors={['#FFAA75', '#FF72BE']}
                    style={styles.medalArtwork}
                  />

                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={styles.medalName}>
                      {medal?.name ?? 'Your medal collection'}
                    </Text>
                    <Text style={styles.medalDescription}>
                      {medal?.description ||
                        (medal
                          ? 'Earned'
                          : 'Your earned medals will appear here.')}
                    </Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next medal"
                  disabled={earnedMedals.length < 2}
                  onPress={() => moveMedal(1)}
                  style={styles.arrowButton}
                >
                  <Text style={styles.arrow}>→</Text>
                </Pressable>
              </View>

              {!!earnedMedals.length && (
                <Text style={styles.position}>
                  {currentMedalIndex + 1} / {earnedMedals.length}
                </Text>
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({

  screen: { 
    gap: 10, 
    paddingBottom: 20,
  },
  back: { 
    minHeight: 44, 
    justifyContent: 'center' 
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#494949',
  },
  heading: { 
    gap: 8, 
    marginBottom: 6, 
  },
  eyebrow: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    letterSpacing: 1,
    color: '#111111',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: '#494949',
  },
  challengePanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 20, 
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: '#494949',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#494949',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  carousel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  arrowButton: {
    width: 34,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { 
    fontSize: 24, 
    color: '#494949' 
  },
  challengeCard: {
    width: '64%', 
    minHeight: 280,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 16, 
    alignItems: 'center',
    gap: 8,
  },
  challengeArtwork: {
    width: 86,
    height: 110,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    marginBottom: 2,
  },
  challengeName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: '#494949',
    textAlign: 'center',
  },
  challengeDescription: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    lineHeight: 16, 
    color: '#494949',
    textAlign: 'center',
  },
  requirement: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#494949',
    textAlign: 'center',
  },
  joinButton: {
    marginTop: 18,
    minHeight: 44,
    minWidth: 150,
    padding: 8, 
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinedButton: { backgroundColor: '#CEFF32' },
  progress: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 17,
    color: '#727272',
    textAlign: 'center',
  },
  position: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#494949',
    textAlign: 'center',
  },
  medalHeading: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 18,
    color: '#494949',
  },
  medalCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 94,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  medalArtwork: { 
    width: 54, 
    height: 54, 
    borderRadius: 10 
  },
  medalName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: '#494949',
  },
  medalDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#727272',
  },
  error: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#A32929',
  },
});