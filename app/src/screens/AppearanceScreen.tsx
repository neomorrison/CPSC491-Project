import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';

import ProfileCard from '../components/ProfileCard';
import {
  fetchAppearance,
  saveAppearance,
} from '../lib/appearance';
import type { AppearanceData } from '../lib/appearance';
import {
  PROFILE_THEMES,
  canUseTheme,
  getProfileTheme,
} from '../theme/profileThemes';
import type { ThemeId } from '../theme/profileThemes';
import ProfileIdentity from '../components/ProfileIdentity';
import {
  AVATARS,
  FRAMES,
  getAvatar,
  getFrame,
} from '../theme/profileRewards';
import type {
  AvatarId,
  FrameId,
} from '../theme/profileRewards';

type Props = {
  displayName: string;
  onBack: () => void;
  onThemeSaved: (theme: string) => void;
};

type Tab = 'Themes' | 'Avatars' | 'Frames';
const PREVIEW_ALL_THEMES = true; 

function LockIcon() {
  return (
    <Svg width={20} height={24} viewBox="0 0 20 24">
      <Path
        d="M5 10V6a5 5 0 0 1 10 0v4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.5}
      />
      <Rect
        x={2}
        y={10}
        width={16}
        height={12}
        rx={2}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.5}
      />
      <Path
        d="M10 14v4"
        stroke="#FFFFFF"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

export default function AppearanceScreen({
  displayName,
  onBack,
  onThemeSaved,
}: Props) {
  const [data, setData] = useState<AppearanceData | null>(null);
  const [selected, setSelected] = useState<ThemeId>('default');
  const [tab, setTab] = useState<Tab>('Themes');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const savingRef = useRef(false);
  const [avatarId, setAvatarId] = useState<AvatarId>('initials');
  const [frameId, setFrameId] = useState<FrameId>('minimal');

  const hasChanges =
     data !== null &&
  (
     selected !== data.theme ||
     avatarId !== data.avatarId ||
     frameId !== data.frameId
  );  

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    fetchAppearance()
      .then(result => {
        if (!active) return;

        setData(result);
        setSelected(getProfileTheme(result.theme).id);
        setAvatarId(getAvatar(result.avatarId).id);
        setFrameId(getFrame(result.frameId).id);
      })
      .catch((caught: unknown) => {
        if (!active) return;

        setError(
          caught instanceof Error
            ? caught.message
            : typeof caught === 'object' &&
               caught !== null &&
               'message' in caught
            ? String(caught.message)
            : 'Unable to load your appearance.'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reload]);

  async function saveLook() {
    if (!data || savingRef.current || !hasChanges) {
      return;
    }

    if (
        !PREVIEW_ALL_THEMES && 
        !canUseTheme(getProfileTheme(selected), data.level)
    ) {
      setError('This theme is still locked.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await saveAppearance({
        theme: selected,
          avatarId,
          frameId,
    });

       setData(previous =>
  previous
    ? {
        ...previous,
        theme: selected,
        avatarId,
        frameId,
      }
    : previous
     );

      onThemeSaved(selected);
      setMessage('Your look has been saved.');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to save your look. Please try again.'
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        disabled={saving}
        style={styles.backButton}
      >
        <Text style={styles.backText}>← Profile</Text>
      </Pressable>

      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Make it your style</Text>
        <Text style={styles.title}>Appearance</Text>
      </View>

      {loading ? (
        <ActivityIndicator
          color="#006868"
          accessibilityLabel="Loading appearance"
        />
      ) : !data ? (
        <View style={styles.panel}>
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => setReload(value => value + 1)}
            style={styles.backButton}
          >
            <Text style={styles.backText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ProfileCard
            displayName={displayName}
            rank={data.rank}
            level={data.level}
            xpIntoLevel={data.xpIntoLevel}
            xpForNextLevel={data.xpForNextLevel}
            themeId={selected}
            preview
            onEditProfile={saveLook}
            actionLabel={saving ? 'Saving…' : 'Save look'}
            actionDisabled={saving || !hasChanges}
          />

          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}

          {!!message && (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.message}
            >
              {message}
            </Text>
          )}

          <View style={styles.panel}>
            <LinearGradient
              colors={['#FFAA75', '#F3A7EF']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.tabs}
            >
              {(['Themes', 'Avatars', 'Frames'] as const).map(item => (
                <Pressable
                  key={item}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === item }}
                  onPress={() => setTab(item)}
                  style={[
                    styles.tab,
                    tab === item && styles.activeTab,
                  ]}
                >
                  <View
                    style={[
                      styles.tabDot,
                      tab === item && styles.activeDot,
                    ]}
                  />

                  <Text style={styles.tabText}>{item}</Text>
                </Pressable>
              ))}
            </LinearGradient>

            {tab === 'Themes' ? (
              <>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>
                    Choose your energy
                  </Text>
                  <Text style={styles.description}>
                    Color changes apply across your profile.
                  </Text>
                </View>

                <View style={styles.grid}>
                  {PROFILE_THEMES.map(theme => {
                    const locked = !PREVIEW_ALL_THEMES && !canUseTheme(theme, data.level);
                    const equipped = data.theme === theme.id;
                    const previewing =
                      selected === theme.id && !equipped;

                    return (
                      <Pressable
                        key={theme.id}
                        accessibilityRole="button"
                        accessibilityLabel={
                          locked
                            ? `${theme.name}, unlocks at level ${theme.minimumLevel}`
                            : `${theme.name}${equipped ? ', equipped' : ''}`
                        }
                        accessibilityState={{
                          disabled: locked || saving,
                          selected: selected === theme.id,
                        }}
                        disabled={locked || saving}
                        onPress={() => {
                          setSelected(theme.id);
                          setError('');
                          setMessage('');
                        }}
                        style={[
                          styles.themeTile,
                          previewing && styles.previewingTile,
                        ]}
                      >
                        <LinearGradient
                          colors={theme.colors}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          style={styles.swatch}
                        >
                          {locked && <LockIcon />}
                        </LinearGradient>

                        {locked && (
                          <Text style={styles.unlockText}>
                            Unlock at Level {theme.minimumLevel}
                          </Text>
                        )}

                        <View style={styles.tileCaption}>
                          <Text style={styles.themeName}>
                            {theme.name}
                          </Text>

                          {!locked && (
                            <Text style={styles.status}>
                              {equipped
                                ? 'Equipped'
                                : previewing
                                  ? 'Previewing'
                                  : 'Tap to try'}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>
                  {tab === 'Avatars'
                    ? 'Pick an avatar'
                    : 'Pick your frame'}
                </Text>
                <Text style={styles.description}>
                  Coming soon.
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 20,
    paddingBottom: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#494949',
  },
  heading: {
    gap: 12,
    marginBottom: 6,
  },
  eyebrow: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    letterSpacing: 1,
    color: '#111111',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: '#494949',
  },
  panel: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 18,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 5,
  },
  tab: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 11,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
  },
  tabDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  activeDot: {
    backgroundColor: '#FFAA75',
    borderWidth: 1,
    borderColor: '#EF6006',
  },
  tabText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#494949',
  },
  sectionHeading: {
    gap: 7,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#494949',
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 15,
    color: '#494949',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  themeTile: {
    width: '48%',
    minHeight: 91,
    padding: 9,
    borderRadius: 14,
    backgroundColor: '#F1F1F1',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 5,
  },
  previewingTile: {
    borderColor: '#006868',
  },
  swatch: {
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
    textAlign: 'center',
    color: '#727272',
  },
  tileCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 'auto',
  },
  themeName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#494949',
  },
  status: {
    fontFamily: 'Inter_400Regular',
    fontSize: 7,
    color: '#727272',
  },
  error: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#A32929',
  },
  message: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#006868',
  },
});