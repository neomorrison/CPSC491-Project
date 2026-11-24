import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { supabase } from '../lib/supabase';

type AuthFormProps = {
  mode: 'signup' | 'login';
  onSwitch: () => void;
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

export function AuthForm({ mode, onSwitch }: AuthFormProps) {
  const isSignUp = mode === 'signup';

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submitting = useRef(false);

  async function submit() {
    if (submitting.current) return;

    setError('');
    setNotice('');

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (isSignUp && !trimmedName) {
      setError('Enter your name.');
      return;
    }

    if (!trimmedEmail || !password) {
      setError('Enter your email and password.');
      return;
    }

    submitting.current = true;
    setBusy(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              display_name: trimmedName,
            },
          },
        });

        if (signUpError) throw signUpError;

        setPassword('');

        if (!data.session) {
          setNotice(
            'Check your email to confirm your account, then return here to log in.'
          );
        }
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });

        if (signInError) throw signInError;

        setPassword('');
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#028A8A" />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView
        style={styles.frame}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['#E8742B', '#F09AB0', '#F3A7EF']}
            locations={[0, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            {isSignUp ? (
              <View style={styles.welcomeCopy}>
                <Text style={styles.welcomeText}>Welcome to</Text>
                <Text style={styles.signupBrand}>Ascend</Text>
                <Text style={styles.heroSubtitle}>
                  Ready to embark on your fitness journey?
                </Text>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={onSwitch}
                  disabled={busy}
                  accessibilityRole="button"
                  style={styles.topLink}
                >
                  <Text style={styles.topLinkText}>
                    Don’t have an account?{' '}
                    <Text style={styles.bold}>Get Started</Text>
                  </Text>
                </Pressable>

                <Text style={styles.loginBrand}>Ascend</Text>
              </>
            )}
          </LinearGradient>

          <View style={styles.formStack}>
            <LinearGradient
              pointerEvents="none"
              colors={['#028A8A', '#012424']}
              style={styles.backPanel}
            />

            <View style={styles.panel}>
              <View style={styles.heading}>
                <Text style={styles.title}>
                  {isSignUp ? 'Create Your Account' : 'Welcome Back!'}
                </Text>

                <Text style={styles.subtitle}>
                  {isSignUp
                    ? 'Your new adventure starts here!'
                    : 'Enter your details below'}
                </Text>
              </View>

              <View style={styles.fields}>
                {isSignUp && (
                  <TextInput
                    accessibilityLabel="Name"
                    placeholder="Enter your name"
                    placeholderTextColor="#B0CADD"
                    value={name}
                    onChangeText={setName}
                    editable={!busy}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    maxLength={60}
                    returnKeyType="next"
                    style={styles.input}
                  />
                )}

                <TextInput
                  accessibilityLabel="Email"
                  placeholder="Enter email"
                  placeholderTextColor="#B0CADD"
                  value={email}
                  onChangeText={setEmail}
                  editable={!busy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  style={styles.input}
                />

                <TextInput
                  accessibilityLabel="Password"
                  placeholder={
                    isSignUp ? 'Create a password' : 'Enter password'
                  }
                  placeholderTextColor="#B0CADD"
                  value={password}
                  onChangeText={setPassword}
                  editable={!busy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  secureTextEntry
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                  style={styles.input}
                />
              </View>

              {!isSignUp && (
                <Pressable
                  disabled
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password, coming soon"
                  accessibilityState={{ disabled: true }}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              )}

              {!!error && (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.error}
                >
                  {error}
                </Text>
              )}

              {!!notice && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.notice}
                >
                  {notice}
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.submitButton,
                  (pressed || busy) && styles.pressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>Get Started</Text>
                )}
              </Pressable>

              {isSignUp && (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={onSwitch}
                  style={styles.bottomLink}
                >
                  <Text style={styles.bottomLinkText}>
                    Already have an account?{' '}
                    <Text style={styles.pinkLink}>Log in</Text>
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function SignUpScreen({
  onLogin,
}: {
  onLogin: () => void;
}) {
  return <AuthForm mode="signup" onSwitch={onLogin} />;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#D4E7E7',
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 402,
    backgroundColor: '#FFFFFF',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Extend the gradient behind the full curve of the white 
  hero: {
    height: 300,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  welcomeCopy: {
    paddingTop: 70,
    alignItems: 'center',
  },
  welcomeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 30,
    color: '#FFFFFF',
  },
  signupBrand: {
    fontFamily: 'Inter_700Bold',
    fontSize: 40,
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    color: '#FFFFFF',
    marginTop: 10,
  },
  topLink: {
    paddingVertical: 12,
    marginTop: 54,
  },
  topLinkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  bold: {
    fontFamily: 'Inter_700Bold',
  },
  loginBrand: {
    fontFamily: 'Inter_700Bold',
    fontSize: 48,
    color: '#FFFFFF',
    marginTop: 44,
  },
  formStack: {
    flex: 1,
    marginTop: -76,
    paddingTop: 20,
  },
  backPanel: {
    position: 'absolute',
    top: 0,
    left: 19,
    right: 19,
    height: 90,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    opacity: 0.45,
  },
  panel: {
    flex: 1,
    minHeight: 558,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    backgroundColor: '#FFFFFF',
    paddingTop: 32,
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  heading: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 6,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
    color: '#006868',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    color: '#028A8A',
  },
  fields: {
    gap: 10,
  },
  input: {
    height: 68,
    borderWidth: 1,
    borderColor: '#028A8A',
    borderRadius: 16,
    paddingHorizontal: 22,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#244646',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
  },
  forgotText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#006868',
    opacity: 0.5,
  },
  submitButton: {
    height: 58,
    marginTop: 34,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#028A8A',
    shadowColor: '#638E9F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  submitText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.7,
  },
  bottomLink: {
    alignSelf: 'center',
    marginTop: 34,
    paddingVertical: 12,
  },
  bottomLinkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textAlign: 'center',
    color: '#006868',
  },
  pinkLink: {
    fontFamily: 'Inter_700Bold',
    color: '#FF6A94',
  },
  error: {
    marginTop: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: '#B42318',
  },
  notice: {
    marginTop: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: '#006868',
  },
});