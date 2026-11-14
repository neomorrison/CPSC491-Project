import { useId, useState } from 'react';
import { 
    Pressable, 
    StyleSheet, 
    Text, 
    View 
} from 'react-native';
import Svg, {
    Circle, 
    Defs, 
    LinearGradient,
    Stop,
} from 'react-native-svg'; 

type Destination = 
| 'Home'
| 'Workouts'
| 'Challenges'
| 'Progress'
| 'Profile';

type MainTab = Exclude<Destination, 'Challenges'>;

type Props = {
    onNavigate: (screen: MainTab) => void;
    onChallenges: () => void;
}; 

const menuItems: Destination[] = [
    'Home', 
    'Workouts', 
    'Challenges', 
    'Progress', 
    'Profile', 
]; 

// Creates a circle with a vertical gradient outline. 
function GradientRing({ showDots = false }: { showDots?: boolean }) {
    const gradientId = `ring${useId().replace(/:/g, '')}`;

    return (
        <Svg width={41} height={41} viewBox="0 0 41 41">
            <Defs>
                <LinearGradient
                id={gradientId}
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
            >
                <Stop offset="0%" stopColor="#06C38B" />
                <Stop offset="100%" stopColor="#006868"/>
            </LinearGradient>
            </Defs>

            <Circle
               cx={20.5}
               cy={20.5}
               r={19}
               fill="none"
               stroke={`url(#${gradientId})`}
               strokeWidth={3}
            />

            {showDots && (
                <>
                <Circle cx={14.5} cy={20.5} r={1.8} fill="#000000" />
                <Circle cx={20.5} cy={20.5} r={1.8} fill="#000000" />
                <Circle cx={26.5} cy={20.5} r={1.8} fill="#000000" />
                </>
            )}
        </Svg>
    );
}

export default function ScreenActions({
    onNavigate, 
    onChallenges,
}: Props) {
    const [menuOpen, setMenuOpen] = useState(false);

    function selectDestination(destination: Destination) {
        setMenuOpen(false);

        if (destination === 'Challenges') {
            onChallenges(); 
            return;
        }

        onNavigate(destination);
    }

    return (
        <View style={styles.container}>
            <View style={styles.actions}>
                {/* Placeholder for a future action or icon */}
            <View
            style={styles.circleContainer}
            accessible={false}
            >
                <GradientRing />
            </View>

            <Pressable
            accessibilityRole="button"
            accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setMenuOpen(open => !open)}
            style={({ pressed }) => [
                styles.circleContainer,
                pressed && styles.pressed,
            ]}
            >
                <GradientRing showDots />
            </Pressable>
        </View>

        {menuOpen && (
            <View style={styles.menu}>
            {menuItems.map(item => (
                <Pressable
                key={item}
                accessibilityRole="button"
                onPress={() => selectDestination(item)}
                style={({ pressed }) => [
                    styles.menuItem,
                    pressed && styles.pressed, 
                ]}
                >
                    <Text style={styles.menuText}>{item}</Text>
                </Pressable>
            ))}
            </View>
        )}
     </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative', 
        width: '100%', 
        zIndex: 20, 
    }, 

    actions: {
        flexDirection: 'row', 
        justifyContent: 'flex-end', 
        alignItems: 'center', 
        gap: 10, 
    }, 

    circleContainer: {
        width: 44, 
        height: 44, 
        alignItems: 'center',
        justifyContent: 'center', 
    }, 

    menu: {
        position: 'absolute', 
        top: 52, 
        left: 0, 
        right: 0, 
        backgroundColor: '#006868', 
        borderRadius: 15, 
        paddingVertical: 16, 
        paddingHorizontal: 20, 
        zIndex: 21, 
        elevation: 8, 
    }, 

    menuItem: {
        minHeight: 42, 
        justifyContent: 'center',
        paddingHorizontal: 8, 
    }, 

    menuText: {
        fontFamily: 'Inter_400Regular', 
        fontSize: 16, 
        color: '#FFFFFF'
    }, 

    pressed: {
        opacity: 0.65, 
    }
}); 
