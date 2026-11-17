import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';

type LogWorkoutScreenProps = {
  workoutName: string;
  duration: string;
  onWorkoutNameChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onSave: (details: {
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
    notes: string;
  }) => void;
  
 onBack: () => void;
};

export default function LogWorkoutScreen({
  workoutName,
  duration,
  onWorkoutNameChange,
  onDurationChange,
  onSave,
  onBack,
}: LogWorkoutScreenProps) {

const [workoutType, setWorkoutType] = useState<
'Strength' | 'Cardio' | 'Mobility'
>('Strength');

const [intensity, setIntensity] = useState<
  'Light' | 'Moderate' | 'Hard'
>('Moderate');


const [workoutDate, setWorkoutDate] = useState(() => {
  const today = new Date();

  return [
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
    today.getFullYear(),
  ].join('/');
});
const [notes, setNotes] = useState('');

type ExerciseEntry = {
  id: number;
  name: string;
  sets: string;
  reps: string;
  weight: string;
};

const [exercises, setExercises] = useState<ExerciseEntry[]>([]);

const addExercise = () => {
  setExercises(previous => [
    ...previous,
    {
      id: Date.now(),
      name: '',
      sets: '',
      reps: '',
      weight: '',
    },
  ]);
};
const removeExercise = (id: number) => {
  setExercises(previous =>
    previous.filter(exercise => exercise.id !== id)
  );
};
const updateExercise = (
  id: number,
  field: 'name' | 'sets' | 'reps' | 'weight',
  value: string
) => {
  setExercises(previous =>
    previous.map(exercise =>
      exercise.id === id
        ? { ...exercise, [field]: value }
        : exercise
    )
  );
};

const handleSave = () => {
  const formattedExercises = exercises
    .filter(exercise => exercise.name.trim() !== '')
    .map(exercise => ({
      id: exercise.id,
      name: exercise.name.trim(),
      sets: Number(exercise.sets),
      reps: Number(exercise.reps),
      weight: Number(exercise.weight),
    }));

    const dateParts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(workoutDate);

    const formattedDate = dateParts
      ? `${dateParts[3]}-${dateParts[1]}-${dateParts[2]}`
      : workoutDate;
    
    onSave({
      workoutType,
      intensity,
      date: formattedDate,
      exercises: formattedExercises,
      notes: notes.trim(),
    });
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log Workout</Text>
        <Text style={styles.label}>Workout type</Text>
        <View style={styles.typeRow}>
          {(['Strength', 'Cardio', 'Mobility'] as const).map((type) => (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityState={{ selected: workoutType === type }}
              onPress={() => setWorkoutType(type)}
              style={[
                styles.typeButton,
                workoutType === type && styles.selectedType,
              ]}
            >
              <Text style={styles.typeText}>{type}</Text>
            </Pressable>
          ))}
        </View>

      <Text style={styles.label}>Workout name</Text>
      <TextInput
        accessibilityLabel="Workout name"
        placeholder="e.g. Running, Yoga, Weightlifting"
        value={workoutName}
        onChangeText={onWorkoutNameChange}
        style={styles.input}
      />
  
      <Text style={styles.label}>Date</Text>

      <TextInput
        accessibilityLabel="Workout date"
        placeholder="MM/DD/YYYY"
        value={workoutDate}
        onChangeText={setWorkoutDate}
        style={styles.input}
      />

      <Text style={styles.label}>Duration (minutes)</Text>
      <TextInput
        accessibilityLabel="Workout duration"
        placeholder="e.g. 30"
        keyboardType="number-pad"
        value={duration}
        onChangeText={onDurationChange}
        style={styles.input}
      />
  {/* WORKOUT INTENSITY */}
<Text style={styles.label}>Intensity</Text>

<View style={styles.typeRow}>
  {(['Light', 'Moderate', 'Hard'] as const).map((option) => (
    <Pressable
      key={option}
      accessibilityRole="button"
      accessibilityState={{ selected: intensity === option }}
      onPress={() => setIntensity(option)}
      style={[
        styles.typeButton,
        intensity === option && styles.selectedType,
      ]}
    >
      <Text style={styles.typeText}>{option}</Text>
    </Pressable>
  ))}
</View>


<View style={styles.exerciseHeader}>
  <Text style={styles.label}>Exercises</Text>

  <Pressable onPress={addExercise} accessibilityRole="button">
    <Text style={styles.addExerciseText}>+ Add Exercise</Text>
  </Pressable>
</View>

{exercises.map((exercise, index) => (

<View key={exercise.id} style={styles.exerciseCard}>
  <View style={styles.exerciseHeader}>
    <Text style={styles.label}>Exercise {index + 1}</Text>

    {exercises.length > 1 && (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove exercise ${index + 1}`}
        onPress={() => removeExercise(exercise.id)}
      >
        <Text style={styles.removeText}>Remove</Text>
      </Pressable>
    )}
  </View>
    <TextInput
      accessibilityLabel={`Exercise ${index + 1} name`}
      placeholder="e.g. Goblet Squat"
      value={exercise.name}
      onChangeText={value =>
        updateExercise(exercise.id, 'name', value)
      }
      style={styles.input}
    />

    <View style={styles.typeRow}>
      {([
        { field: 'sets', label: 'Sets', placeholder: '3' },
        { field: 'reps', label: 'Reps', placeholder: '12' },
        { field: 'weight', label: 'Weight (lb)', placeholder: '30' },
      ] as const).map(item => (
        <View key={item.field} style={{ flex: 1 }}>
          <Text style={styles.label}>{item.label}</Text>
          <TextInput
            accessibilityLabel={`Exercise ${index + 1} ${item.label}`}
            placeholder={item.placeholder}
            keyboardType={
              item.field === 'weight' ? 'decimal-pad' : 'number-pad'
            }
            value={exercise[item.field]}
            onChangeText={value =>
              updateExercise(exercise.id, item.field, value)
            }
            style={styles.input}
          />
        </View>
      ))}
    </View>
  </View>
))}

<Text style={styles.label}>Notes (optional)</Text>

<TextInput
  accessibilityLabel="Workout notes"
  placeholder="How did your workout go?"
  value={notes}
  onChangeText={setNotes}
  multiline
  numberOfLines={4}
  textAlignVertical="top"
  style={[styles.input, styles.notesInput]}
/>

    <Pressable style={styles.button} onPress={handleSave}>        <Text style={styles.buttonText}>Save Workout</Text>
      </Pressable>
  
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backText}>Back to Home</Text>
      </Pressable>
    </View>
  );  
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 15,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#494949',
  },
  label: {
    fontSize: 14,
    color: '#494949',
  },
  input: {
    borderWidth: 1,
    borderColor: '#C2C2C2',
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
  },
  button: {
    backgroundColor: '#028A8A',
    padding: 14,
    borderRadius: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  backButton: {
    padding: 12,
    alignItems: 'center',
  },
  backText: {
    color: '#028A8A',
    fontWeight: '600',
  },
  
typeRow: {
  flexDirection: 'row',
  gap: 8,
},

typeButton: {
  flex: 1,
  paddingVertical: 12,
  paddingHorizontal: 4,
  borderRadius: 20,
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#C2C2C2',
  alignItems: 'center',
},

selectedType: {
  backgroundColor: '#FFAA75',
  borderColor: '#FFAA75',
},

typeText: {
  color: '#494949',
  fontSize: 12,
  fontWeight: '500',
},

exerciseHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},

addExerciseText: {
  color: '#028A8A',
  fontSize: 14,
  fontWeight: '600',
},

exerciseCard: {
  gap: 10,
  padding: 12,
  borderRadius: 14,
  backgroundColor: '#B7EFDE',
},
removeText: {
  color: '#B42318',
  fontSize: 12,
  fontWeight: '600',
},
notesInput: {
  minHeight: 100,
  paddingTop: 12,
},
});