import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Tab = 'Home' | 'Workouts' | 'Log' | 'Progress' | 'Profile';

type BottomNavProps = {
  selected: Tab;
  onSelect: (tab: Tab) => void;
};

const tabs: Tab[] = [
  'Home',
  'Workouts',
  'Log',
  'Progress',
  'Profile',
];

export default function BottomNav({
  selected,
  onSelect,
}: BottomNavProps) {
  return (
    <View style={styles.bar}>

      {/* Three button dividers at 20%, 50% and 80%. */}
      <View
        pointerEvents="none"
        style={styles.separatorLayer}
      >
        {[20, 50, 80].map(position => (
      <View
         key={position}
         style={[
            styles.separator,
            { left: `${position}%` },
         ]}
       />
    ))}
      </View>

      {tabs.map(tab => {
        const isLog = tab === 'Log';
        const isSelected = selected === tab;

        return (
          <Pressable
            key={tab}
            accessibilityRole="button"
            accessibilityLabel={
              isLog ? 'Log a workout' : tab
            }
            accessibilityState={{
              selected: isSelected,
            }}
            onPress={() => onSelect(tab)}
            style={({ pressed }) => [
              styles.button,
              isLog && styles.logButton,
              pressed && styles.pressed,
            ]}
            
          >
            {isLog ? (
              <View style={styles.diamond}>
                <View style={styles.diamondContent}>
                  <Text style={styles.plus}>+</Text>
                  <Text style={styles.logLabel}>Log</Text>
                </View>
              </View>
            ) : (
              <View style={styles.iconSlot}>
                {/* Replace with this tab's SVG icon. */}
                <View
                  style={[
                    styles.placeholderIcon,
                    isSelected && styles.selectedIcon,
                  ]}
                />
              </View>
            )}

            {!isLog && (
              <Text
                style={[
                  styles.label,
                  isSelected && styles.selectedLabel,
                ]}
              >
                {tab}
              </Text>
            )}

          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: '#1D7979',

    borderWidth: 1,
    borderColor: '#004A4A',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,

    paddingTop: 12,
    paddingBottom: 12,
    overflow: 'visible',
  },

  button: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  pressed: {
    opacity: 0.65,
  },

  iconSlot: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    opacity: 0.7,
  },

  selectedIcon: {
    opacity: 1,
  },

    label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#FFFFFF',
  },

  selectedLabel: {
    fontFamily: 'Inter_600SemiBold',
  },

  logLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },


  logButton: {
    zIndex: 2,
    overflow: 'visible',
  },

  diamond: {
    position: 'absolute',
    top: -20,

    width: 54,
    height: 54,
    borderRadius: 16,

    backgroundColor: '#FFAA75',
    borderWidth: 2,
    borderColor: '#EF6006',

    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
   },

   diamondContent: {
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
   },

    plus: {
    fontSize: 26,
    lineHeight: 28,
    color: '#FFFFFF',
   },

    separatorLayer: {
     position: 'absolute',
     top: 0,
     right: 0,
     bottom: 0,
     left: 0,
    },

    separator: {
    position: 'absolute',
    top: 32,
    width: 1,
    height: 32,
    borderRadius: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    transform: [{ translateX: -0.5 }],
   },
  });
