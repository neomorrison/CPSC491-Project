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
        id: 'weekly_workouts', 
        label: 'Workouts / week', 
        targetLabel: 'Weekly target', 
    }, 
    {
        id: 'weekly_minutes', 
        label:'Active days / week', 
        targetLabel: 'weekly active days target', 
    }, 
    {
        id: 'streak', 
        label: 'Streak target', 
        targetLabel: 'Streak target (days)', 
    }, 
]