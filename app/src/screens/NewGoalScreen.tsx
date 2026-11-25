import { useState } from 'react';
import {
    Pressable, 
    StyleSheet, 
    Text, 
    TextInput, 
    View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient'; 

const goalTypes = [
    {
        id: 'workouts_per_week', // matches GoalType in src/lib/goals.ts
        label: 'Workouts / week', 
        targetLabel: 'Weekly target', 
    }, 
    {
        id: 'active_days_per_week', 
        label:'Active days / week', 
        targetLabel: 'weekly active days target', 
    }, 
    {
        id: 'streak', 
        label: 'Streak target', 
        targetLabel: 'Streak target (days)', 
    }, 
]