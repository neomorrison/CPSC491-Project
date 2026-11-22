
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
    totalWorkouts: number;
    weeklyWorkouts: number;
    totalMinutes: number;
    streak: number;
    workoutDates: string[];
  };
  
  export default function ProgressScreen({
    totalXp,
    level,
    xpIntoLevel,
    xpForNextLevel,
      totalWorkouts,
      weeklyWorkouts,
      totalMinutes,
      streak,
      workoutDates,
  }: ProgressScreenProps) {

const today = new Date();

// Find the Sunday of the current week
const weekStart = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate() - today.getDay()
);

// Create seven dates, Sunday through Saturday
const weekDays = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + index);

  return {
    key: `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`,
    label: date.toLocaleDateString('en-US', {
      weekday: 'short',
    }),
    day: date.getDate(),
  };
});

const activeDates = new Set(workoutDates);
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

<View style={styles.statsCard}>
  <Text style={styles.levelText}>Workout Statistics</Text>

  <View style={styles.statsGrid}>
    {[
      { label: 'Total Workouts', value: totalWorkouts, color: '#FFAA75' },
      { label: 'This Week', value: weeklyWorkouts, color: '#FFADDD' },
      { label: 'Total Minutes', value: totalMinutes, color: '#B7EFDE' },
      { label: 'Current Streak', value: `${streak} days`, color: '#F1F1F1' },
    ].map(stat => (
      <View
        key={stat.label}
        style={[styles.statBox, { backgroundColor: stat.color }]}
      >
        <Text style={styles.statLabel}>{stat.label}</Text>
        <Text style={styles.statValue}>{stat.value}</Text>
      </View>
    ))}
  </View>
</View>

</View>

{/* WORKOUT STREAK CALENDAR */}
<View style={styles.calendarCard}>
  <Text style={styles.levelText}>
    Workout Activity
  </Text>

  <Text style={styles.subtitle}>
    Your workouts this week
  </Text>

  <View style={styles.calendarRow}>
    {weekDays.map(day => {
      const completed = activeDates.has(day.key);

      return (
        <View key={day.key} style={styles.calendarDay}>
          <Text style={styles.calendarLabel}>
            {day.label}
          </Text>

          <View
            style={[
              styles.calendarDate,
              completed && styles.completedDate,
            ]}
          >
            <Text style={styles.calendarNumber}>
              {day.day}
            </Text>

            <Text style={styles.calendarCheck}>
              {completed ? '✓' : '·'}
            </Text>
          </View>
        </View>
      );
    })}
  </View>
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

statsCard: {
  gap: 12,
  marginTop: 8,
},

statsGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
},

statBox: {
  width: '48%',
  padding: 14,
  borderRadius: 14,
  gap: 8,
},

statLabel: {
  fontSize: 13,
  color: '#203535',
},

statValue: {
  fontSize: 24,
  fontWeight: '700',
  color: '#203535',
},

calendarCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 18,
  padding: 16,
  gap: 12,
  marginTop: 8,
},

calendarRow: {
  flexDirection: 'row',
  gap: 4,
},

calendarDay: {
  flex: 1,
  alignItems: 'center',
  gap: 8,
},

calendarLabel: {
  fontSize: 11,
  color: '#526666',
},

calendarDate: {
  width: '100%',
  minHeight: 54,
  borderRadius: 12,
  backgroundColor: '#F1F1F1',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
},

completedDate: {
  backgroundColor: '#B7EFDE',
},

calendarNumber: {
  fontSize: 15,
  fontWeight: '600',
  color: '#203535',
},

calendarCheck: {
  fontSize: 13,
  color: '#087F80',
},
});
