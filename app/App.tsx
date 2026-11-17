import { useState } from 'react';
import { StatusBar } from 'expo-status-bar'; 
import BottomNav from './src/components/BottomNav'; 
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ScreenActions from './src/components/ScreenActions';
import HomeSummary from './src/components/HomeSummary';
import LogWorkoutScreen from './src/screens/LogWorkoutScreen';
// The font for the whole app 
import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold} from '@expo-google-fonts/inter';

import {
    Alert, Platform, Pressable, ScrollView, StatusBar as NativeStatusBar, 
    StyleSheet, Text,TextInput, View, useWindowDimensions, } 
    from 'react-native'; 



const colors = {
    background: '#F1F1F1', text: '#203535', muted: '#526666', 
    teal: '#087F80', orange: '#FFAB73', pink: '#FFADDD', mint: '#B5EDDD',
}; 


type Exercise = {
  id: number;
  name: string;
  sets: number;
  reps: number;
  weight: number;
};

type Workout = {
  id: number;
  name: string;
  minutes: number;
  date: string;
  workoutType?: 'Strength' | 'Cardio' | 'Mobility';
  intensity?: 'Light' | 'Moderate' | 'Hard';
  exercises?: Exercise[];
  notes?: string;
};
const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
function ProgressBar({ value, total }: { value: number; total:number }) {
    const percent = 
    total > 0 
       ? Math.max(0, Math.min(100, value / total 
    * 100))
        : 0; 
    return <View accessible accessibilityRole="progressbar" accessibilityLabel="Progress"
    accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }} style={styles.track}>
    <View style ={[styles.fill, { width: `${percent}%` }]} /></View>; 

}
export default function App() {
    const { height: windowHeight } = useWindowDimensions(); 
    const [fontsLoaded, fontError] = useFonts({
       Inter_300Light,
       Inter_400Regular,
       Inter_500Medium,
       Inter_600SemiBold,
       Inter_700Bold,
       Inter_800ExtraBold,
    });
    // Bottom Nav button 
    const [screen, setScreen] = useState<
       'Home' | 'Workouts' | 'Log' | 'Progress' | 'Profile'
    >('Home');
    const [profile, setProfile] = useState({displayName: '', weeklyTarget: '', experience: '', plannedDays: [] as string []});
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [workoutName, setWorkoutName] = useState('');
    const [duration, setDuration] = useState('');
    const [challengeJoined, setChallengeJoined] = useState(false);
    const [challengeClaimed, setChallengeClaimed] = useState(false); 
    const now = new Date();
    const today = dateKey(now); 
    const weekStart = new Date(
        now.getFullYear(), 
        now.getMonth(), 
        now.getDate() - now.getDay()
    );

    const week = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart); date.setDate(date.getDate() + index); return date; 
    }); 
    const weeklyKeys = new Set(week.map(dateKey));
    const weeklyWorkouts = workouts.filter(w => weeklyKeys.has(w.date));
    const target = Number(profile.weeklyTarget) || 0;
    const activeDays = new Set(workouts.map(w=> w.date));

    // Basic calendar streak preview 
    let streak = 0; 
    const cursor = new Date(now);
    if (!activeDays.has(today)) cursor.setDate(cursor.getDate() -1); 
    while (activeDays.has(dateKey(cursor))) { streak ++; cursor.setDate(cursor.getDate() - 1); }

    // Reward rules for UI testing only: >=10 minutes, first two/day +50 each
    const rewardedPerDay: Record<string, number> = {};
    const workoutXp = workouts.reduce((sum, workout) => {
        const used = rewardedPerDay[workout.date] || 0;
        if (workout.minutes < 10 || used >= 2) return sum;
        rewardedPerDay[workout.date] = used + 1; return sum + 50; 
    }, 0);
    const xp = workoutXp + (challengeClaimed ? 40 : 0);

    // Level 1 starts at 0 XP; provisional thresholds 100, 200, 300... per level
    let level = 1; 
    let levelXp = xp; 
    while (levelXp >= 100 * level) { 
      levelXp -= 100 * level; 
      level++; 
    }
    const nextLevelXp = 100 * level; 
    const challengeReady =   
      challengeJoined && 
      workouts.some(w => w.date === today && w.minutes >= 10);

    const medals = challengeClaimed ? 1 : 0; 
    
function saveWorkout(details: {
  workoutType: 'Strength' | 'Cardio' | 'Mobility';
  intensity: 'Light' | 'Moderate' | 'Hard';
  date: string;
  exercises: {
    id: number;
    name: string;
    sets: number;
    reps: number;
    weight: number;
  }[];
}) {
  const minutes = Number(duration);

  // Validate workout name and duration
  if (
    !workoutName.trim() ||
    !Number.isInteger(minutes) ||
    minutes <= 0
  ) {
    Alert.alert(
      'Check workout',
      'Enter a workout name and a positive whole number of minutes.'
    );
    return;
  }

  // Validate the workout date
  const dateMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(details.date);

  if (!dateMatch) {
    Alert.alert('Invalid date', 'Use YYYY-MM-DD format.');
    return;
  }

  const [, year, month, day] = dateMatch.map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    Alert.alert('Invalid date', 'Enter a real calendar date.');
    return;
  }

  // Validate exercise details
  const invalidExercise = details.exercises.some(
    exercise =>
      !exercise.name.trim() ||
      !Number.isInteger(exercise.sets) ||
      exercise.sets <= 0 ||
      !Number.isInteger(exercise.reps) ||
      exercise.reps <= 0 ||
      !Number.isFinite(exercise.weight) ||
      exercise.weight < 0
  );

  if (invalidExercise) {
    Alert.alert(
      'Check exercises',
      'Enter valid sets, reps, and weight for each exercise.'
    );
    return;
  }

  // Save the complete workout
  setWorkouts(previous => [
    ...previous,
    {
      id: Date.now(),
      name: workoutName.trim(),
      minutes,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      workoutType: details.workoutType,
      intensity: details.intensity,
      exercises: details.exercises,
    },
  ]);

  setWorkoutName('');
  setDuration('');
  setScreen('Home');
}
    const button = (label: string, action: () => void) => <Pressable accessibilityRole="button"
      onPress={action} style ={styles.primaryButton}><Text style={styles.buttonText}>{label}</Text></Pressable>;
    if (fontError) {
  return (
    <View>
      <Text>
        Unable to load Inter: {fontError.message}
      </Text>
    </View>
  );
}

if (!fontsLoaded) {
  return (
    <View>
      <Text>Loading fonts…</Text>
    </View>
  );
}
      return (
         <View 
              style={[
                styles.root,
                Platform.OS === 'web' && { height: windowHeight },
              ]}
            >
        <StatusBar style="dark" />

        {/* Brand appears on all main screens and the home renders its own circles inside the gradient  */}
        <View style={styles.screenActions}>
        <Text style={styles.brand}>Ascend</Text>

          {screen !== 'Home' && (
    <ScreenActions
      onNavigate={destination => setScreen(destination)}
      onChallenges={() =>
        Alert.alert(
          'Challenges',
          'The Challenges screen will be connected here.'
        )
      }
    />
   )}
   </View>

   <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
       styles.content,
       screen === 'Home' && styles.homeContent,
    ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
          {/* Home receives shared data and navigation callbacks from App. */}
{screen === 'Home' && (
  <HomeScreen
    displayName={profile.displayName}
    challengesCompleted={challengeClaimed ? 1 : 0}
    medalsEarned={medals}
    workoutsLoggedToday={
      workouts.filter(workout => workout.date === today).length
    }
    actions={
      <ScreenActions
        onNavigate={destination => setScreen(destination)}
        onChallenges={() =>
          Alert.alert(
            'Challenges',
            'The Challenges screen will be connected here.'
          )
        }
      />
    }
    onChallenges={() =>
      Alert.alert(
        'Challenges',
        'The Challenges screen will be connected here.'
      )
    }
    summary={
       <HomeSummary
          weeklyWorkouts={weeklyWorkouts.length}
          weeklyTarget={target}
          totalXp={xp}
          level={level}
          xpIntoLevel={levelXp}
         xpForNextLevel={nextLevelXp}
         rank={
           level >= 20 ? 'Legend' :
           level >= 15 ? 'Athlete' :
           level >= 10 ? 'Grinder' :
           level >= 5 ? 'Regular' :
           'Starter'
        }
        streak={streak}
      />
    }
    onMedals={() => setScreen('Profile')}
    onProgress={() => setScreen('Progress')}
    onOpenWorkout={() => setScreen('Workouts')}
  />
)}


       {/* PROFILE BLOCK for receiving shared user data from App. */}
       {screen === 'Profile' && (
         <ProfileScreen
           displayName={profile.displayName}
           experience={profile.experience}
           plannedDays={profile.plannedDays}
           rank={
              level >= 20 ? 'Legend' :
              level >= 15 ? 'Athlete' :
              level >= 10 ? 'Grinder' :
              level >= 5 ? 'Regular' :
              'Starter'
           }
           level={level}
           xpIntoLevel={levelXp}
           xpForNextLevel={nextLevelXp}
           onSaveProfile={changes => {
            setProfile(previous => ({
              ...previous, 
              ...changes, 
           })); 
          }}
        />
      )}
      
{/* LOG WORKOUT SCREEN */}

{screen === 'Log' && (
  <LogWorkoutScreen
    workoutName={workoutName}
    duration={duration}
    onWorkoutNameChange={setWorkoutName}
    onDurationChange={setDuration}
    onSave={saveWorkout}
    onBack={() => setScreen('Home')}
  />
)}

{/* WORKOUT HISTORY SCREEN */}
{screen === 'Workouts' && (
  <View style={{ gap: 16 }}>
    <Text style={styles.workoutTitle}>My Workouts</Text>

    <Text style={styles.caption}>
      Your recent workout activity
    </Text>

    {workouts.length === 0 ? (
      <View style={styles.card}>
        <Text style={styles.body}>
          You haven't logged any workouts yet.
        </Text>

        <Text style={styles.caption}>
          Start your fitness journey by logging your first workout!
        </Text>

        {button('Log Your First Workout', () => setScreen('Log'))}
      </View>
    ) : (
      [...workouts].reverse().map((workout) => (
        <View key={workout.id} style={styles.card}>
          <Text style={styles.title}>{workout.name}</Text>

          <Text style={styles.body}>
            Duration: {workout.minutes} minutes
          </Text>

          <Text style={styles.caption}>
            Date: {workout.date}
          </Text>

          {workout.workoutType && (
            <Text style={styles.body}>
              Type: {workout.workoutType}
            </Text>
          )}

          {workout.intensity && (
            <Text style={styles.body}>
              Intensity: {workout.intensity}
            </Text>
          )}

          {workout.exercises && workout.exercises.length > 0 && (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Text style={styles.title}>Exercises</Text>

              {workout.exercises.map((exercise) => (
                <View
                  key={exercise.id}
                  style={{
                    backgroundColor: '#B7EFDE',
                    padding: 12,
                    borderRadius: 12,
                    gap: 4,
                  }}
                >
                  <Text style={styles.title}>
                    {exercise.name}
                  </Text>

                  <Text style={styles.body}>
                    {exercise.sets} sets × {exercise.reps} reps
                  </Text>

                  <Text style={styles.caption}>
                    Weight: {exercise.weight} lb
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))
    )}

    {workouts.length > 0 &&
      button('+ Log Another Workout', () => setScreen('Log'))}
  </View>
)}

</ScrollView>
    <BottomNav
        selected={screen}
        onSelect={setScreen}
    />
</View>
 );
}


const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: '#B5CCCC', borderRadius: 12, padding: 12, minHeight: 48, color: colors.text },
   root: {
  flex: Platform.OS === 'web' ? undefined : 1,
  width: '100%',
  maxWidth: Platform.OS === 'web' ? 390 : undefined,
  marginHorizontal: 'auto',
  alignSelf: 'center',
  backgroundColor: colors.background,
  overflow: 'hidden',
  paddingTop:
    Platform.OS === 'android'
      ? (NativeStatusBar.currentHeight ?? 0)
      : 0,
},

scroll: {
  flex: 1,
  minHeight: 0,
},

content: {
  padding: 16,
  gap: 16,
  paddingBottom: 100,
},
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
},
  brand: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: colors.teal 
},
  menu: { 
    minWidth: 44, 
    minHeight: 44, 
    alignItems: 'center', 
    justifyContent: 'center' 
},
  menuText: { 
    fontSize: 20, 
    color: colors.teal
},
  greeting: { 
    gap: 4 
},
  name: { 
    fontSize: 30, 
    fontWeight: '700', 
    color: colors.text 
},
  body: { 
    fontSize: 15, 
    color: colors.text 
},
  caption: { 
    fontSize: 13, 
    color: colors.muted 
},
  calendar: { 
    flexDirection: 'row', 
    gap: 4 
},
  day: { 
    flex: 1, 
    alignItems: 'center', 
    paddingVertical: 12, 
    gap: 8, 
    borderRadius: 14 
},
  selectedDay: { 
    backgroundColor: colors.orange 
},

homeContent: {
  padding: 0,
  paddingBottom: 24,
  gap: 0,
},


  dayLabel: { 
    fontSize: 11, 
    color: colors.text 
},
  dayNumber: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: colors.text 
},
  row: { 
    flexDirection: 'row', 
    gap: 12 
},
  shortcut: { 
    flex: 1, 
    padding: 16, 
    gap: 12, 
    borderRadius: 18, 
    minHeight: 100 
},
  card: { 
    padding: 16, 
    gap: 12, 
    borderRadius: 18, 
    backgroundColor: '#FFFFFF' 
},
  half: { 
    flex: 1, 
    minWidth: 0 
},
  title: { 
    fontFamily: 'Inter_600SemiBold', 
    fontSize: 16, 
    color: colors.text 
},
  workoutTitle: { 
    fontSize: 26, 
    fontWeight: '700', 
    color: colors.text 
},
  primaryButton: { 
    minHeight: 48, 
    padding: 12, 
    borderRadius: 24,
    backgroundColor: colors.teal, 
    alignItems: 'center', 
    justifyContent: 'center' 
},
  buttonText: { 
    color: '#FFFFFF', 
    fontWeight: '600', 
    fontSize: 15 
},
  track: { 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#F1F1F1', 
    overflow: 'hidden' 
},
  fill: { 
    height: '100%', 
    backgroundColor: colors.teal, 
    borderRadius: 4 
},
  stat: { 
    fontSize: 24, 
    fontWeight: '700', 
    color: colors.text 
},
  demoNote: { 
    fontSize: 12, 
    textAlign: 'center', 
    color: colors.muted 
},
  nav: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: colors.teal,
    paddingHorizontal: 8, 
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopLeftRadius: 18, 
    borderTopRightRadius: 18 
},
  navItem: { 
    flex: 1, 
    minHeight: 48, 
    alignItems: 'center', 
    justifyContent: 'center' 
},
  navText: { 
    color: '#FFFFFF', 
    fontSize: 11 
},
  activeNav: { 
    fontWeight: '800', 
    textDecorationLine: 'underline' 
},
  logButton: { 
    backgroundColor: colors.orange, 
    borderRadius: 16 
},
  logText: { 
    color: colors.text, 
    fontWeight: '700' 
},

screenActions: {
  position: 'relative', 
  paddingHorizontal: 16, 
  paddingTop: 12, 
  paddingBottom: 8, 
  gap: 12, 
  backgroundColor: '#F1F1F1', 
  zIndex: 20, 
  flexShrink: 0, 
},         
});