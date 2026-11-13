import { StyleSheet, Text, View } from 'react-native'; 
import ProfileCard from '../components/ProfileCard';

type ProfileScreenProps = {
    displayName: string;
    rank: string;
    level: number; 
    xpIntoLevel: number; 
    xpForNextLevel: number; 
    onEditProfile: () => void;
}; 

export default function ProfileScreen({
    displayName, 
    rank, 
    level, 
    xpIntoLevel, 
    xpForNextLevel, 
    onEditProfile, 
}: ProfileScreenProps) {
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
            onEditProfile={onEditProfile}
            />
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
    color: '#494949',
  },

  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: '#4A4A4A',
  },
});
