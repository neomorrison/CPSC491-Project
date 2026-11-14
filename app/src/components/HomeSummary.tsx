// Bottom of the homescreen summary 

import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
    Circle, 
    Defs, 
    LinearGradient as SvgGradient, 
    Stop, 
    Text as SvgText, 
    TSpan, 
} from 'react-native-svg'; 

type Props = {
    weeklyWorkouts: number; 
    weeklyTarget: number; 
    totalXp: number; 
    level: number; 
    xpIntoLevel: number; 
    xpForNextLevel: number; 
    rank: string; 
    streak: number; 


    // Connect these when the reward/history data is available 
    bestStreak?: number; 
    weeklyRewardXp?: number; 
    frameUnlockXp?: number;
}; 


function MilestoneRing({
    value, 
    total, 
}: {
    value: number;
    total: number; 
}) {
    const radius = 35; 
    const circumference = 2 * Math.PI * radius; 
    const fraction = 
    total > 0 ? Math.min(1, Math.max(0, value / total)) : 0; 

    // Treating 8.35 degrees as the starting rotation of the arc.
    const rotation = -90 + 8.35; 

    return (
        <View 
        style={styles.ringContainer}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="XP toward the next level"
        accessibilityValue={{
            min: 0, 
            max: Math.max(1, total), 
            now: Math.max(0, Math.min(value, Math.max(1, total))), 
        }}
    > 
    <Svg width={80} height={80} viewBox="0 0 80 80">
    {/* Empty part of the ring. */}
    <Circle 
    cx={40}
    cy={40}
    r={radius}
    fill="none"
    stroke="#028A8A"
    strokeWidth={10}
    />
   {fraction > 0 && (
          <>
            {/* Border around the filled portion. */}
            <Circle
              cx={40}
              cy={40}
              r={radius}
              fill="none"
              stroke="#06C38B"
              strokeWidth={10}
              strokeDasharray={[
                circumference * fraction,
                circumference * (1 - fraction),
              ]}
              rotation={rotation}
              origin="40, 40"
            />

            <Circle
              cx={40}
              cy={40}
              r={radius}
              fill="none"
              stroke="#B7EFDE"
              strokeWidth={8}
              strokeDasharray={[
                circumference * fraction,
                circumference * (1 - fraction),
              ]}
              rotation={rotation}
              origin="40, 40"
            />
          </>
        )}
      </Svg>

      <View style={styles.ringLabels} pointerEvents="none">
        <Text style={styles.ringValue}>
          {value.toLocaleString()}/
        </Text>
        <Text style={styles.ringTotal}>
          {total.toLocaleString()}
        </Text>
        <Text style={styles.ringTotal}>XP</Text>
      </View>
    </View>
  );
}

function StreakValue({ days }: { days: number }) {
  const id = `streak${useId().replace(/:/g, '')}`;

  return (
    <Svg
      width="100%"
      height={43}
      viewBox="0 0 140 43"
      accessible
      accessibilityLabel={`${days} days`}
    >
      <Defs>
        <SvgGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#006868" />
          <Stop offset="100%" stopColor="#06C38B" />
        </SvgGradient>
      </Defs>

      <SvgText
        x={0}
        y={33}
        fill={`url(#${id})`}
        fontFamily="Inter_700Bold"
      >
        <TSpan fontSize={30}>{days}</TSpan>
        <TSpan fontSize={12}> days</TSpan>
      </SvgText>
    </Svg>
  );
}

export default function HomeSummary({
  weeklyWorkouts,
  weeklyTarget,
  totalXp,
  level,
  xpIntoLevel,
  xpForNextLevel,
  rank,
  streak,
  bestStreak,
  weeklyRewardXp,
  frameUnlockXp,
}: Props) {
  const target = Math.max(0, weeklyTarget);
  const remaining = Math.max(0, target - weeklyWorkouts);
  const progress =
    target > 0
      ? Math.min(1, Math.max(0, weeklyWorkouts / target))
      : 0;

  const goalCaption =
    target === 0
      ? 'Set a weekly target in your profile'
      : remaining === 0
        ? 'Weekly goal completed!'
        : `${remaining} more ${
            remaining === 1 ? 'workout' : 'workouts'
          } to complete`;

  const frameCaption =
    frameUnlockXp === undefined
      ? 'More profile frame rewards coming soon'
      : totalXp >= frameUnlockXp
        ? 'New profile frame unlocked'
        : `${(frameUnlockXp - totalXp).toLocaleString()} XP to unlock a new profile frame`;

  return (
    <View style={styles.container}>
      {/* Weekly workout goal. */}
      <View style={styles.weeklySection}>
        <Text style={styles.weeklyTitle}>Weekly Goal</Text>

        <Text style={styles.weeklyAmount}>
          {target > 0
            ? `${weeklyWorkouts} of ${target} workouts`
            : 'Set your weekly goal'}
        </Text>

        <View style={styles.progressRow}>
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Weekly workout goal"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: Math.round(progress * 100),
            }}
          >
            {progress > 0 && (
              <LinearGradient
                colors={['#FF72BE', '#E8742B']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.goalFill,
                  { width: `${progress * 100}%` },
                ]}
              />
            )}
          </View>

          {weeklyRewardXp !== undefined && (
            <Text style={styles.smallText}>
              +{weeklyRewardXp} XP
            </Text>
          )}
        </View>

        <Text style={styles.smallText}>{goalCaption}</Text>
      </View>

      {/* Milestone card beside the streak and total XP cards. */}
      <View style={styles.cards}>
        <View style={styles.milestoneCard}>
          <Text style={styles.milestoneTitle}>Next Milestone</Text>
          <Text style={styles.levelTitle}>Level {level + 1}</Text>

          <View style={styles.centered}>
            <MilestoneRing
              value={xpIntoLevel}
              total={xpForNextLevel}
            />

            <Text style={styles.rankText}>
              Current Rank:{'\n'}{rank}
            </Text>
          </View>

          <Text style={styles.unlockText}>{frameCaption}</Text>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.streakCard}>
            <Text style={styles.streakTitle}>Current Streak</Text>

            <StreakValue days={streak} />

            <View style={styles.bestPill}>
              <Text style={styles.bestText}>
                Best {bestStreak ?? '—'}
              </Text>
            </View>
          </View>

          <LinearGradient
            colors={['#EF6006', '#EF6006', '#F3A7EF']}
            locations={[0, 0.28, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.totalCard}
          >
            <View style={styles.xpIconPlaceholder} />

            <Text style={styles.totalAmount}>
              {totalXp.toLocaleString()}
            </Text>

            <Text style={styles.totalLabel}>Total XP</Text>
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 26,
    gap: 30,
  },

  weeklySection: {
    paddingHorizontal: 14,
    gap: 7,
  },

  weeklyTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#494949',
    letterSpacing: 1,
  },

  weeklyAmount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: '#494949',
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },

  track: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#D9D9D9',
    overflow: 'hidden',
  },

  goalFill: {
    height: '100%',
    borderRadius: 5,
  },

  smallText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 8,
    color: '#000000',
  },

  cards: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 18,
  },

  milestoneCard: {
    flex: 1.35,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    minHeight: 230,
  },

  milestoneTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#727272',
    letterSpacing: 1,
  },

  levelTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: '#494949',
    marginTop: 10,
  },

  centered: {
    alignItems: 'center',
    marginTop: 8,
  },

  ringContainer: {
    width: 80,
    height: 80,
    position: 'relative',
  },

  ringLabels: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ringValue: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 8,
    color: '#000000',
  },

  ringTotal: {
    fontFamily: 'Inter_500Medium',
    fontSize: 8,
    color: '#000000',
  },

  rankText: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 8,
    color: '#000000',
    textAlign: 'center',
    marginTop: 12,
  },

  unlockText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 8,
    color: '#727272',
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: 16,
  },

  rightColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
    gap: 18,
  },

  streakCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    minHeight: 106,
  },

  streakTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#000000',
  },

  bestPill: {
    alignSelf: 'flex-end',
    backgroundColor: '#4CB4B4',
    borderColor: '#006868',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },

  bestText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#FFFFFF',
  },

  totalCard: {
    borderRadius: 18,
    padding: 12,
    minHeight: 106,
  },

  xpIconPlaceholder: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },

  totalAmount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: '#FFFFFF',
  },

  totalLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 3,
  },
});



