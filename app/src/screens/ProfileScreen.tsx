import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ProfileCard from '../components/ProfileCard';
import ProfileExtras from '../components/ProfileExtras';

export type ProfileEdits = {
  displayName: string;
  experience: string;
  plannedDays: string[];
};

type ProfileScreenProps = {
  displayName: string;
  experience: string;
  plannedDays: string[];
  rank: string;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  onSaveProfile: (changes: ProfileEdits) => void;
};

const days = [
  { value: 'sun', label: 'Sun' },
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
];

const experiences = [
  'Beginner',
  'Intermediate',
  'Advanced',
];

export default function ProfileScreen({
  displayName,
  experience,
  plannedDays,
  rank,
  level,
  xpIntoLevel,
  xpForNextLevel,
  onSaveProfile,
}: ProfileScreenProps) {
  const [editing, setEditing] = useState(false);

  // Draft values are separate from the saved profile.
  const [draft, setDraft] = useState<ProfileEdits>({
    displayName,
    experience,
    plannedDays: [...plannedDays],
  });

  function openEditor() {
    // Always begin with the latest saved values.
    setDraft({
      displayName,
      experience,
      plannedDays: [...plannedDays],
    });
    setEditing(true);
  }

  function toggleDay(day: string) {
    setDraft(previous => ({
      ...previous,
      plannedDays: previous.plannedDays.includes(day)
        ? previous.plannedDays.filter(item => item !== day)
        : [...previous.plannedDays, day],
    }));
  }

  function saveChanges() {
    if (!draft.displayName.trim()) {
      Alert.alert(
        'Display name required',
        'Enter the name you want shown on your profile.'
      );
      return;
    }

    if (!draft.experience) {
      Alert.alert(
        'Choose an experience level',
        'Select Beginner, Intermediate, or Advanced.'
      );
      return;
    }

    onSaveProfile({
      ...draft,
      displayName: draft.displayName.trim(),
      plannedDays: [...draft.plannedDays],
    });

    setEditing(false);
  }

  const initials = draft.displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase();

  if (editing) {
    return (
      <View style={styles.screen}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditing(false)}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Profile</Text>
        </Pressable>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Personalize</Text>
          <Text style={styles.title}>Edit Profile</Text>
        </View>

        <LinearGradient
          colors={['#06C38B', '#006868']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.editCard}
        >
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.initials}>
                {initials || '?'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert(
                  'Appearance',
                  'Earned avatar selection will be added here.'
                )
              }
              style={styles.avatarButton}
            >
              <Text style={styles.buttonText}>
                Change avatar
              </Text>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Display name</Text>

            <TextInput
              accessibilityLabel="Display name"
              placeholder="Enter your display name"
              placeholderTextColor="#737373"
              value={draft.displayName}
              onChangeText={value =>
                setDraft(previous => ({
                  ...previous,
                  displayName: value,
                }))
              }
              maxLength={40}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Experience Level
            </Text>

            <View style={styles.experienceRow}>
              {experiences.map(option => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: draft.experience === option,
                  }}
                  onPress={() =>
                    setDraft(previous => ({
                      ...previous,
                      experience: option,
                    }))
                  }
                  style={[
                    styles.experienceButton,
                    draft.experience === option &&
                      styles.selectedExperience,
                  ]}
                >
                  <Text style={styles.choiceText}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Planned workout weekdays
            </Text>

            <View style={styles.daysRow}>
              {days.map(day => {
                const selected =
                  draft.plannedDays.includes(day.value);

                return (
                  <Pressable
                    key={day.value}
                    accessibilityRole="button"
                    accessibilityLabel={day.label}
                    accessibilityState={{ selected }}
                    onPress={() => toggleDay(day.value)}
                    style={styles.dayButton}
                  >
                    <Text style={styles.dayText}>
                      {day.label}
                    </Text>

                    <View
                      style={[
                        styles.dayDot,
                        selected && styles.selectedDot,
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.helper}>
              Planned days determine streak status
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={saveChanges}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>
              Save Changes
            </Text>
          </Pressable>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Your Space</Text>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ProfileCard
        displayName={displayName}
        rank={rank}
        level={level}
        xpIntoLevel={xpIntoLevel}
        xpForNextLevel={xpForNextLevel}
        onEditProfile={openEditor}
      />

      <ProfileExtras /> 
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 20,
  },

  heading: {
    gap: 12,
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
    color: '#4A4A4A',
  },

  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },

  backText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#111111',
  },

  editCard: {
    borderRadius: 25,
    padding: 18,
    gap: 26,
  },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
  },

  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  initials: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: '#4A4A4A',
  },

  avatarButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },

  field: {
    gap: 8,
  },

  fieldLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#FFFFFF',
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#111111',
  },

  experienceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  experienceButton: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedExperience: {
    backgroundColor: '#CEFF32',
    borderWidth: 1,
    borderColor: '#09FB8B',
  },

  choiceText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#111111',
  },

  daysRow: {
    flexDirection: 'row',
    gap: 4,
  },

  dayButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  dayText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#4A4A4A',
  },

  dayDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ABABAB',
  },

  selectedDot: {
    backgroundColor: '#FF6DB8',
  },

  helper: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#FFFFFF',
  },

  saveButton: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ABABAB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },

  buttonText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#111111',
  },

  pressed: {
    opacity: 0.75,
  },
});