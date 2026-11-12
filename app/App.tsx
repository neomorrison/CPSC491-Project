import { useState } from 'react';
import { StatusBar } from 'expo-status-bar'; 
import BottomNav from './src/components/BottomNav'; 

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

type Workout = { id: number; name: string; minutes: number; date: string }; 
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
    const [profile, setProfile] = useState({displayName: '', weeklyTarget: '', experience: ''});
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
    let level = 1; let levelXp = xp; 
    while (levelXp >= 100 * (level + 1)) { levelXp -= 100 * (level + 1); level++; }
    const nextLevelXp = 100 * (level + 1); 
    const challengeReady =   
      challengeJoined && 
      workouts.some(w => w.date === today && w.minutes >= 10);

    const medals = challengeClaimed ? 1 : 0; 
    function saveWorkout() {
        const minutes = Number(duration); 
        if (!workoutName.trim() || !Number.isFinite(minutes) || minutes <= 0 || !Number.isInteger(minutes)) {
            Alert.alert('Check workout', 'Enter a workout name and a positive whole number of minutes.'); return ;
        }
        setWorkouts(previous => [...previous, { id: Date.now(), name: workoutName.trim(), minutes, date: today }]);
        setWorkoutName(''); setDuration(''); setScreen('Home');
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
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>Ascend</Text>
          {screen === 'Home' && <>

          <View style={styles.greeting}>
            <Text style={styles.body}>Welcome{profile.displayName.trim() ? ',': ''}</Text>
            <Text style={styles.name}>{profile.displayName.trim() || 'Set up your profile'}</Text>
            <Text style={styles.caption}>
                {now.toLocaleDateString(undefined, 
                { weekday: 'long', 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric',
                })}
            </Text>
            
          </View>
          <View style={styles.calendar}>
            {week.map((date) => (
               <View 
                 key={dateKey(date)}
                 style={[
                   styles.day, 
                   dateKey(date) === today && 
        styles.selectedDay,
                        ]}
                     >
                       <Text style={styles.dayLabel}>
        {date.toLocaleDateString(undefined, { 
                            weekday: 'short', 
                            })}
                            </Text>     
                <Text style={styles.dayNumber}>
                    {date.getDate()}
                    </Text>
                <Text style={styles.caption}>
                    {activeDays.has(dateKey(date)) ? 
    '✓' : '·'}
                    </Text>
                  </View>
                ))}
            </View>
 
            <View style={[styles.row]}>
                <View 
                style={[
                    styles.shortcut, 
                    { backgroundColor: colors.orange }
                    ]}
                    >
                        <Text style={styles.title}>Challenges completed</Text>
                        <Text style={styles.stat}>{challengeClaimed ? 1 : 0}</Text>
                </View>

                <View 
                style={[
                    styles.shortcut, 
                    { backgroundColor: colors.pink},
                    ]}
                >
                         <Text style={styles.title}>Medals earned</Text>
                         <Text style={styles.stat}>{medals}</Text>
                </View>
            </View>
            <View style={styles.card}><Text 
            style={styles.title}>Today's activity</Text>

            <Text style={styles.body}>{workouts.filter(w => w.date === today).length} workouts logged</Text>

            <Text style={styles.caption}> No workout plan set yet.</Text>
            {button('Log a workout', () => setScreen('Log'))}</View>
            
         <View style={styles.card}><Text style={styles.title}> Weekly goal</Text>
           <Text style={styles.stat}>{xp} XP</Text><ProgressBar value={levelXp} total={nextLevelXp} />
           <Text style={styles.caption}>{nextLevelXp - levelXp} XP to level {level + 1}</Text></View>
        <View style={[styles.card, styles.half]}><Text style={styles.title}>Current streak</Text><Text style={styles.stat}>{streak} days</Text></View>
        <View style={styles.card}><Text style={styles.title}>Daily starter challenge</Text>
          <Text style={styles.body}>Log a workout of at least 10 minutes today.</Text>
          {challengeClaimed ? <Text>Completed · medal earned</Text> : !challengeJoined
            ? button('Join challenge', () => setChallengeJoined(true))
            : challengeReady ? button('Claim 40 XP and medal', () => setChallengeClaimed(true))
            : <Text style={styles.caption}>Joined · waiting for a qualifying workout</Text>}
        </View>
      </>}


        {/* Temporary profile edit setup */}

      {screen === 'Profile' && <View style={styles.card}>
        <Text style={styles.name}>Your profile</Text>
        <Text>Display name</Text>
        <TextInput accessibilityLabel="Display name" 
        placeholder="Enter your display name"
          value={profile.displayName} onChangeText={displayName => setProfile(p => ({ ...p, displayName }))} style={styles.input} />
        <Text>Weekly workout target</Text>
        <TextInput accessibilityLabel="Weekly workout target" placeholder="Set a target"
          keyboardType="number-pad" value={profile.weeklyTarget}
          onChangeText={weeklyTarget => setProfile(p => ({ ...p, weeklyTarget: weeklyTarget.replace(/[^0-9]/g, '') }))} style={styles.input} />
        <Text>Experience level</Text>{['Beginner', 'Intermediate', 'Advanced'].map(experience =>
          <Pressable key={experience} accessibilityRole="button" onPress={() => setProfile(p => ({ ...p, experience }))} style={styles.input}>
            <Text>{profile.experience === experience ? '✓ ' : ''}{experience}</Text></Pressable>)}
        <Text style={styles.caption}>Edits update this session immediately. Additional settings and permanent saving will be connected later.</Text>
        </View>}
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
  paddingBottom: 24,
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

          
});