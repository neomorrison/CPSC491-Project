import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthGate({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [notice, setNotice] = useState('');

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

        if (error) setErrorMessage(error.message);
        setSession(data.session);
        setChecking(false);
      })
      .catch(error => {
        if (!active || authEventReceived) return;

        setErrorMessage(
          error instanceof Error ? error.message : 'Session check failed.'
        );
        setChecking(false);
      });

    // Refresh mobile sessions while the app is in the foreground.
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

  async function signIn() {
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      setPassword('');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to sign in.'
      );
    } finally {
      setBusy(false);
    }
  }

  // Sign up is a working outline that reuses the sign-in styles. Gala: style it however you like.
  async function signUp() {
    setErrorMessage('');
    setNotice('');

    if (!email.trim() || password.length < 6) {
      setErrorMessage('Enter an email and a password of at least 6 characters.');
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      // When "Confirm email" is on in Supabase there's no session until they click the link
      if (!data.session) {
        setNotice('Check your email for a link to confirm your account, then sign in.');
        setMode('signIn');
      }
      setPassword('');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to create your account.'
      );
    } finally {
      setBusy(false);
    }
  }

  const submit = mode === 'signIn' ? signIn : signUp;

  if (checking) {
    return (
      <View style={styles.page}>
        <ActivityIndicator color="#006868" />
        <Text>Checking your session…</Text>
      </View>
    );
  }

  if (session) {
    return <View key={session.user.id} style={styles.app}>{children}</View>;
  }

  return (
    <View style={styles.page}>
      <View style={styles.form}>
        <Text style={styles.title}>
          {mode === 'signIn' ? 'Sign in to Ascend' : 'Create your account'}
        </Text>

        <TextInput
          accessibilityLabel="Email"
          placeholder="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
          style={styles.input}
        />

        <TextInput
          accessibilityLabel="Password"
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          editable={!busy}
          style={styles.input}
        />

        {!!notice && <Text style={styles.notice}>{notice}</Text>}

        {!!errorMessage && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMessage}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={submit}
          disabled={busy}
          style={[styles.button, busy && styles.disabled]}
        >
          <Text style={styles.buttonText}>
            {mode === 'signIn'
              ? busy ? 'Signing in…' : 'Sign in'
              : busy ? 'Creating account…' : 'Create account'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setErrorMessage('');
            setNotice('');
          }}
          disabled={busy}
          style={styles.switchButton}
        >
          <Text style={styles.switchText}>
            {mode === 'signIn'
              ? 'New here? Create an account'
              : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },

  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F1F1',
    padding: 24,
    gap: 12,
  },

  form: {
    width: '100%',
    maxWidth: 360,
    gap: 14,
  },

  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#006868',
  },

  input: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ABABAB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#006868',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  error: {
    color: '#B42318',
  },

  disabled: {
    opacity: 0.6,
  },

  notice: {
    color: '#006868',
  },

  switchButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  switchText: {
    color: '#006868',
    fontWeight: '600',
  },
});