import React from "react";
import type { ReactNode } from "react"; 
import { useId } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
    Circle, Defs, LinearGradient as SvgGradient, Path, Stop, Text as SvgText, TSpan, 
} from 'react-native-svg'; 

type WorkoutPlan = {
    name: string; 
    day: number; 
    totalDays: number; 
    moves: number; 
    sets: number; 
    minutes: number; 
}; 

type Props = {
    displayName: string; 

    // shared circles here so they appear over the gradient. 
    actions?: ReactNode; 

    challengesCompleted: number; 
    medalsEarned: number; 

    // Leaving these undefined for now until the totals are known
    challengesTotal?: number;
    medalsTotal?: number; 

    plan?: WorkoutPlan;
    workoutsLoggedToday: number; 

    onChallenges: () => void; 
    onMedals: () => void; 
    onProgress: () => void; 
    onOpenWorkout: () => void; 
}; 

function localDateKey(date: Date) {
    return [
        date.getFullYear(), 
        date.getMonth() + 1, 
        date.getDate(), 
    ].join('-'); 
}

// Rounded arrow for the circle tab 
function Arrow({ color = '#FFFFFF' }: { color?: string }) {
    return (
        <Svg width={20} height={20} viewBox="0 0 24 24"> 
        <Path 
        d="M4 12h15M13 5l7 7-7 7"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        />
        </Svg>
    ); 
}

function WorkoutRing() {
    const id = `workoutRing${useId().replace(/:/g, '')}`; 

    // The pink/orange gradient ring 
    const arcFraction = (360 - 4.81) / 360; 
    const innerLength = 2 * Math.PI * 38; 
    const outerLength = 2 * Math.PI * 48; 

    return (
        <Svg 
        width={100}
        height={100}
        viewBox=" 0 0 100 100"
        accessible={false}
    > 
        <Defs>
            <SvgGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#EF6006"/> 
                <Stop offset="50%" stopColor="#F37375" />
                <Stop offset="100%" stopColor="#FF72BE" /> 
                </SvgGradient>
            </Defs>

            {/* Outer ring: */}
            <Circle 
            cx={50}
            cy={50}
            r={48}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={4}
            opacity={0.2}
            strokeDasharray={[
                outerLength * arcFraction, 
                outerLength * (1 - arcFraction), 
            ]}
            strokeLinecap="round"
            rotation={-90}
            origin="50, 50"
            />

            {/* Inner ring */}
            <Circle
            cx={50}
            cy={50}
            r={38}
            fill="none"
            stroke={`url{#${id}`}
            strokeWidth={7}
            strokeDasharray={[
                innerLength * arcFraction, 
                innerLength * (1 - arcFraction), 
            ]}
            strokeLinecap="round"
            rotation={-90}
            origin="50, 50"
            />
        </Svg>
    ); 

}

function GradientDayLabel({
    day, 
    totalDays, 
}: {
    day?: number; 
    totalDays?: number; 
}) {
    const id = `dayLabel${useId().replace(/:/g, '')}`;

    return (
        <Svg width={165} height={36} viewBox="0 0 165 36">
            <Defs>
                <SvgGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#EF6006" />
                    <Stop offset="0%" stopColor="#FF72BE" />
                </SvgGradient>
            </Defs>

            <SvgText
            x={0}
            y={27}
            fontFamily="Inter_500Medium"
            fontSize={24}
            >
                <TSpan>{`Day ${day ?? '-'}`}</TSpan>
                <TSpan fontSize={18}>{`/${totalDays ?? '-'}`}</TSpan>
            </SvgText>
        </Svg>
    ); 
}

export default function HomeScreen({
    displayName, 
    actions, 
    challengesCompleted, 
    medalsEarned, 
    challengesTotal, 
    medalsTotal,
    plan, 
    workoutsLoggedToday, 
    onChallenges, 
    onMedals, 
    onProgress, 
    onOpenWorkout, 
}: Props) {
    const now = new Date(); 
    const todayKey = localDateKey(now);

    const weekStart = new Date(
        now.getFullYear(), 
        now.getMonth(), 
        now.getDate() - now.getDay()
    ); 

     const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
 const hour = now.getHours();
  const greeting =
    hour < 12
      ? 'Good Morning'
      : hour < 18
        ? 'Good Afternoon'
        : 'Good Evening';

  const todayLabel = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
 return (
    <View style={styles.screen}>
      {/* Top gradient banner. */}
      <LinearGradient
        colors={['#FFE6FE', '#F8CCB7', '#F1B068']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.actions}>{actions}</View>

        <View style={styles.greeting}>
          <Text style={styles.greetingText}>{greeting}</Text>
          <Text style={styles.displayName}>
            {displayName.trim() || 'Your Name'}
          </Text>
        </View>

        <View style={styles.calendar}>
          <Text style={styles.calendarHeading}>
            Today, {todayLabel}
          </Text>

          <View style={styles.week}>
            {week.map(date => {
              const isToday = localDateKey(date) === todayKey;

              return (
                <LinearGradient
                  key={localDateKey(date)}
                  colors={
                    isToday
                      ? ['#006868', '#06C38B']
                      : ['#EF6006', '#EF6006', '#FF9ED2']
                  }
                  style={[
                    styles.datePill,
                    isToday && styles.currentDatePill,
                  ]}
                >
                  <Text style={styles.weekday}>
                    {date.toLocaleDateString('en-US', {
                      weekday: 'short',
                    })}
                  </Text>

                  <View style={styles.dateCircle}>
                    <Text style={styles.dateNumber}>
                      {date.getDate()}
                    </Text>
                  </View>
                </LinearGradient>
              );
            })}
          </View>
        </View>
      </LinearGradient>

 <View style={styles.body}>
        {/* Shortcut cards. */}
        <View style={styles.shortcuts}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open challenges"
            onPress={onChallenges}
            style={[styles.shortcut, styles.challengeCard]}
          >
            <Text style={styles.shortcutTitle}>Challenges</Text>

            <View style={styles.shortcutMiddle}>
              <View style={styles.iconPlaceholder} />
              <Arrow />
            </View>

            <Text style={styles.count}>
              {challengesCompleted}
              <Text style={styles.countTotal}>
                /{challengesTotal ?? '—'}
              </Text>
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open medals"
            onPress={onMedals}
            style={[styles.shortcut, styles.medalCard]}
          >
            <Text style={styles.shortcutTitle}>Medals</Text>

            <View style={styles.shortcutMiddle}>
              <View style={styles.iconPlaceholder} />
              <Arrow />
            </View>

            <Text style={styles.count}>
              {medalsEarned}
              <Text style={styles.countTotal}>
                /{medalsTotal ?? '—'}
              </Text>
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open progress"
            onPress={onProgress}
            style={[styles.shortcut, styles.progressCard]}
          >
            <Text style={styles.shortcutTitle}>Progress</Text>

            <View style={styles.shortcutMiddle}>
              <View style={styles.iconPlaceholder} />
              <Arrow />
            </View>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Today’s Workout</Text>

        {/* Today's workout plan, or an empty state. */}
        <View style={styles.workoutCard}>
          <GradientDayLabel
            day={plan?.day}
            totalDays={plan?.totalDays}
          />

          <View style={styles.workoutDetails}>
            <Text
              style={styles.workoutName}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {plan?.name ?? 'No workout planned'}
            </Text>

            {plan && (
              <View style={styles.chips}>
                <View style={styles.movesChip}>
                  <Text style={styles.movesText}>
                    {plan.moves} moves · {plan.sets} sets
                  </Text>
                </View>

                <View style={styles.minutesChip}>
                  <Text style={styles.minutesText}>
                    {plan.minutes} min
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.ring}>
            <WorkoutRing />
          </View>

          <Text style={styles.loggedLabel}>
            {workoutsLoggedToday} workouts logged
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              plan ? 'Open today’s workout' : 'Choose a workout'
            }
            onPress={onOpenWorkout}
            hitSlop={9}
            style={styles.openWorkout}
          >
            <Arrow color="#006868" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F1F1F1',
  },

  hero: {
    position: 'relative',
    zIndex: 10, 
    height: 238,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 20,
  },

  actions: {
    position: 'absolute', 
    top: 20, 
    left: 15, 
    right: 15, 
    zIndex: 20, 
  },

  greeting: {
    marginTop: 12,
    marginBottom: 20,
  },

  greetingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#000000',
  },

  displayName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: '#000000',
    marginTop: 6,
  },

  calendar: {
    height: 118,
    marginTop: 'auto',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },

  calendarHeading: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#000000',
  },

  week: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  datePill: {
    width: 30,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },

  currentDatePill: {
    height: 65,
  },

  weekday: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#FFFFFF',
  },

  dateCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateNumber: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#494949',
  },

  body: {
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 24,
  },

  shortcuts: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 18,
  },

  shortcut: {
    width: 83,
    height: 83,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingTop: 8,
  },

  challengeCard: {
    backgroundColor: '#F8B68D',
  },

  medalCard: {
    backgroundColor: '#FF9ED2',
  },

  progressCard: {
    backgroundColor: '#4CB4B4',
  },

  shortcutTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#494949',
    textAlign: 'center',
  },

  shortcutMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },

  iconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },

  count: {
    position: 'absolute',
    right: 8,
    bottom: 4,
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    color: '#FFFFFF',
  },

  countTotal: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#FFFFFF',
  },

  sectionTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#000000',
    marginLeft: 12,
    marginBottom: 6,
  },

  workoutCard: {
    height: 183,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    padding: 14,
  },

  workoutDetails: {
    marginTop: 18,
    paddingRight: 110,
  },

  workoutName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    lineHeight: 34,
    color: '#494949',
  },

  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },

  movesChip: {
    width: 95,
    height: 27,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F37375',
    alignItems: 'center',
    justifyContent: 'center',
  },

  movesText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: '#EF6006',
  },

  minutesChip: {
    width: 43,
    height: 27,
    borderRadius: 10,
    backgroundColor: '#EF6006',
    alignItems: 'center',
    justifyContent: 'center',
  },

  minutesText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: '#FFFFFF',
  },

  ring: {
    position: 'absolute',
    right: 16,
    top: 48,
  },

  loggedLabel: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: '#727272',
  },

  openWorkout: {
    position: 'absolute',
    right: 121,
    bottom: 20,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#B7EFDE',
    borderWidth: 1,
    borderColor: '#06C38B',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
