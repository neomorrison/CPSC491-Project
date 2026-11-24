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

/**
 * Controls access to the signed-in app.
 *
 * The signup/login screens handle form fields and authentication requests.
 * This component watches Supabase's session and displays the correct screen.
 */
export default function AuthGate({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  // Used only when signed out to switch between signup and login.
  const [screen, setScreen] = useState<'welcome' | 'login'>('welcome');

  // Session-restoration errors are separate from errors in the login form.
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    // Prevent asynchronous callbacks from updating an unmounted component.
    let active = true;

    // A newer auth event should take priority over the initial session lookup.
    let authEventReceived = false;

    // Subscribe before checking storage so we don't miss a session change.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;

      if (!active) return;

      setSession(nextSession);
      setSessionError('');
      setChecking(false);
    });

    // Restore a previously saved session when the app first opens.
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active || authEventReceived) return;

        if (error) {
          setSessionError(error.message);
        }

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

        // Allow the user to access login even if session restoration fails.
        setChecking(false);
      });

    // Native apps refresh their session while in the foreground.
    // The web client manages its own browser refresh behavior.
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

    // Remove listeners when AuthGate unmounts to avoid duplicate callbacks.
    return () => {
      active = false;
      subscription.unsubscribe();
      appStateSubscription?.remove();

      if (Platform.OS !== 'web') {
        supabase.auth.stopAutoRefresh();
      }
    };
  }, []);

  // Wait for the initial session check to avoid briefly flashing signup.
  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#028A8A" />
        <Text>Checking your session…</Text>
      </View>
    );
  }

  // A valid session opens MainApp, passed into AuthGate as children.
  // The user ID key resets the app's component state if accounts change.
  if (session) {
    return (
      <View key={session.user.id} style={styles.app}>
        {children}
      </View>
    );
  }

  // Signed-out users see the shared, styled signup/login screens.
  // Successful authentication updates the session through the listener above.
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