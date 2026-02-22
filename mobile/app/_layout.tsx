import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import AnimatedSplash from '../components/AnimatedSplash';


export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

SplashScreen.preventAutoHideAsync();

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000000',
    card: '#0A0A0A',
    text: '#FFFFFF',
    border: '#333333',
    primary: '#FFFFFF',
  },
};

function AuthRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    // User is already logged in (app restarted) — check if they have a profile
    api.getProfile(user.user_id)
      .then(() => router.replace('/(tabs)'))
      .catch(() => router.replace('/welcome'));
  }, [user, loading]);

  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <ThemeProvider value={CustomDarkTheme}>
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          <AuthRedirect />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="connect-google" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="map" options={{ presentation: 'card' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
          {showSplash && (
            <AnimatedSplash onFinish={() => setShowSplash(false)} />
          )}
        </View>
      </ThemeProvider>
    </AuthProvider>
  );
}
