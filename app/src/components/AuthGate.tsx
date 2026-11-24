import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '../lib/supabase';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';

export default function AuthGate({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [screen, setScreen] = useState<'welcome' | 'login'>('welcome');
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    let active = true;
    let authEventReceived = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;

      if (active) {
        setSession(nextSession);
        setChecking(false);
      }
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active || authEventReceived) return;

        if (error) setSessionError(error.message);

        setSession(data.session);
        setChecking(false);
      })
      .catch(error => {
        if (!active || authEventReceived) return;

        setSessionError(
          error instanceof Error
            ? error.message
            : 'Unable to restore your session.'
        );
        setChecking(false);
      });

    const appStateSubscription =
      Platform.OS !== 'web'
        ? AppState.addEventListener('change', state => {
            if (state === 'active') {
              supabase.auth.startAutoRefresh();
            } else {
              supabase.auth.stopAutoRefresh();
            }
          })
        : null;

    if (Platform.OS !== 'web' && AppState.currentState === 'active') {
      supabase.auth.startAutoRefresh();
    }

    return () => {
      active = false;
      subscription.unsubscribe();
      appStateSubscription?.remove();

      if (Platform.OS !== 'web') {
        supabase.auth.stopAutoRefresh();
      }
    };
  }, []);

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#028A8A" />
        <Text>Checking your session…</Text>
      </View>
    );
  }

  if (session) {
    return (
      <View key={session.user.id} style={styles.app}>
        {children}
      </View>
    );
  }

  return (
    <View style={styles.app}>
      {!!sessionError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {sessionError}
        </Text>
      )}

      {screen === 'welcome' ? (
        <WelcomeScreen onLogin={() => setScreen('login')} />
      ) : (
        <LoginScreen onSignUp={() => setScreen('welcome')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  error: {
    padding: 12,
    color: '#B42318',
    backgroundColor: '#FFF1F0',
  },
});