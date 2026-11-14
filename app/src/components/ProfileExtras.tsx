// The rest of the profile layout aside from the main profile banner/ edit profile feature
import {
    Alert,
    Pressable, 
    StyleSheet, 
    Text, 
    View, 
} from 'react-native'; 

// Medal tab under profile 
type Medal = {
    id: string; 
    name: string;
}; 

type Destination = 
| 'Achievements'
| 'Goals'
| 'Appearance'
| 'AI connections'
| 'Settings'; 

type ProfileExtraProps = {
    medals?: Medal[]; 
    activeGoals?: number;
    availableUnlocks?: number;
    connectedAssistants?: number; 
    onOpen?: (destination: Destination) => void;
}; 

export default function ProfileExtras({
    medals = [],
    activeGoals = 0, 
    availableUnlocks = 0, 
    connectedAssistants = 0, 
    onOpen, 
}: ProfileExtraProps) {
    function open(destination: Destination) {
        if (onOpen) {
            onOpen(destination); 
            return; 
        }

        // Temporary feedback until destination screens are connected 
        Alert.alert(
            destination, 
            'This screen will be connected next.'
        );
    }

    const rows = [
        // Goals tab
        {
            title: 'Goals' as const, 
            subtitle: `${activeGoals} active ${
              activeGoals === 1 ? 'goal' : 'goals'
            }`, 
            fill: '#A3FBA4',
            stroke: '#09FB8B', 
        }, 

        // Appearance tab 
        {
            title: 'Appearance' as const, 
            subtitle: `${availableUnlocks} ${
            availableUnlocks === 1 ? 'unlock' : 'unlocks'
            } ready`, 
             fill: '#F3A7EF', 
             stroke: '#FF72BE', 
        }, 

        // AI connections tab 
        {
            title: 'AI connections' as const, 
            subtitle: `${connectedAssistants} ${
               connectedAssistants === 1 
               ? 'assistant'
            : 'assistants'
            } connected`, 
             fill: '#FFAA75',
             stroke: '#EF6006', 
        }, 
        // Account settings/ preferences tab
        {
            title: 'Settings' as const, 
            subtitle: 'Account & preferences', 
            fill: '#028A8A', 
            stroke: '#006868',
        },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.achievementSection}>
                <Text style={styles.sectionTitle}>
                    Achievements 
                </Text>

                <View style={styles.achievementCard}>
                    <Text style={styles.victoriesTitle}>
                        Your latest victories
                    </Text>

                    <Pressable 
                      accessibilityRole="button"
                      accessibilityLabel="View all achievements"
                      onPress={() => open('Achievements')}
                      style={styles.viewAllButton}
                    >
                      <Text style={styles.viewAllText}>
                        View all →
                      </Text>
                    </Pressable>

                    <View style={styles.medalRow}>
                        {[0, 1, 2].map(index => {
                            const medal = medals[index]; 
                            
                            return (
                                <View
                                  key={medal?.id ?? `empty-${index}`}
                                  style={styles.medalBox}
                                >
                                  {/* Replace with earned badge artwork later. */}
                                  <Text style={styles.medalText}>
                                    {medal?.name ?? 'Not earned yet'}
                                  </Text>
                                </View>
                            ); 
                        })}
                    </View>
                </View>
            </View>

            <View style={styles.links}>
                {rows.map(row => (
                    <Pressable
                    key={row.title}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.title}, ${row.subtitle}`}
                    onPress={() => open(row.title)}
                    style={({ pressed }) => [
                        styles.linkRow, 
                        pressed && styles.pressed,
                    ]}
                    >
                        <View
                           style={[
                            styles.iconCircle,
                            {
                                backgroundColor: row.fill, 
                                borderColor: row.stroke, 
                            }, 
                           ]}
                           />

                        <View style={styles.linkText}>
                            <Text style={styles.linkTitle}>
                                {row.title}
                            </Text>

                            <Text style={styles.linkSubtitle}>
                                {row.subtitle}
                            </Text>
                        </View>

                        <View
                           accessible={false}
                           style={styles.chevron}
                        />
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 24,
    }, 

    achievementSection: {
        gap: 6,
    }, 

    sectionTitle: {
        fontFamily: 'Inter_400Regular', 
        fontSize: 14, 
        color: '#494949', 
        paddingHorizontal: 12, 
    }, 

    achievementCard: {
        backgroundColor: '#FFFFFF', 
        borderRadius: 14, 
        minHeight: 159, 
        padding: 16, 
        gap: 8, 
    }, 

    victoriesTitle: {
        fontFamily: 'Inter_600SemiBold', 
        fontSize: 16, 
        color: '#494949',
    }, 

    viewAllButton: {
        alignSelf: 'flex-start', 
        minHeight: 24, 
        justifyContent: 'center', 
    }, 

    viewAllText: {
        fontFamily: 'Inter_500Medium', 
        fontSize: 10, 
        color: '#494949', 
    }, 

    medalRow: {
        flexDirection: 'row', 
        gap: 12, 
        marginTop: 4, 
    }, 

    medalBox: {
        flex: 1, 
        minWidth: 0, 
        minHeight: 64, 
        borderRadius: 12, 
        backgroundColor: '#FFECE1', 
        alignItems: 'center', 
        justifyContent: 'flex-end', 
        padding: 10, 
    }, 

    medalText: {
        fontFamily: 'Inter_400Regular', 
        fontSize: 9, 
        color: '#494949', 
    }, 

    links: {
        gap: 14, 
    }, 

    linkRow: {
        flexDirection: 'row',
        alignItems: 'center', 
        gap: 12, 
        minHeight: 62, 
        paddingHorizontal: 16, 
        paddingVertical: 10, 
        borderRadius: 14, 
        backgroundColor: '#FFFFFF', 
    }, 

    iconCircle: {
        width: 30, 
        height: 30, 
        borderRadius: 15, 
        borderWidth: 1, 
    }, 

    linkText: {
        flex: 1, 
        minWidth: 0, 
        gap: 3, 
    }, 

    linkTitle: {
        fontFamily: 'Inter_600SemiBold', 
        fontSize: 12,
        color: '#4E4D4D', 
    }, 

    linkSubtitle: {
        fontFamily: 'Inter_400Regular', 
        fontSize: 11, 
        color: '#727272', 
    }, 

    chevron: {
        width: 6, 
        height: 6, 
        borderTopWidth: 1.5, 
        borderRightWidth: 1.5, 
        borderColor: '#494949',
        transform: [{ rotate: '45deg' }], 
        marginLeft: 8, 
    }, 

    pressed: {
        opacity: 0.7, 
    },
}); 