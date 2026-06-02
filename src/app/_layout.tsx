import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts, ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider, useAuth } from '@/lib/auth';
import { RequireAuthProvider } from '@/lib/requireAuth';
import { ShowSheetProvider } from '@/lib/showSheet';
import { ThemeProvider, useTheme } from '@/lib/theme';

// One-way auth gate (Letterboxd-style): anonymous users browse the catalog
// freely; we never force them into the auth group. When a session lands while
// the user is in the (auth) group, we bounce them to Home with replace('/').
//
// This only works because the auth landing lives at its OWN url — /welcome
// (app/(auth)/welcome.tsx) — NOT at '/'. It used to be app/(auth)/index.tsx,
// which ALSO resolves to '/', so two routes shared one url: replace('/') from
// inside the group was a no-op (already at '/'), and a declarative
// <Redirect href="/"> looped forever (re-resolving to the group's own index).
// Distinct urls fix both.
//
// The `loading` gate HOLDS the UI until the persisted session hydrates from
// AsyncStorage, so no auth-gated screen (Profile) renders a signed-out view off
// a transiently-null session — which dumped a logged-in user on the login screen
// after a reload. The wait is just the AsyncStorage read (~tens of ms).
function AuthGate() {
  const { session, loading } = useAuth();
  const { mode, hydrated } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (session && inAuthGroup) router.replace('/');
  }, [session, loading, segments]);

  // Hold the UI until BOTH the session and the theme preference hydrate from
  // AsyncStorage: the session gate avoids a flash of the signed-out view; the
  // theme gate avoids a flash of the OS theme before a forced light/dark applies.
  if (loading || !hydrated) return null;

  // A native <Stack> (not <Slot>) so every pushed screen gets the iOS push/pop
  // animation AND the interactive swipe-back gesture — the gesture is a feature
  // of the native stack, which <Slot> doesn't provide. headerShown off because
  // every screen draws its own nav row.
  return (
    <>
      {/* One global status bar that flips its CONTENT color with the theme: dark
          glyphs on the light background, light glyphs on the dark one. Screens
          with a dark hero banner mount their own <StatusBar style="light"/>, which
          overrides this while they're on top (correct over the banner in both modes). */}
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          // Edge-only swipe-back (start the drag from the LEFT EDGE). We tried
          // fullScreenGestureEnabled (swipe from anywhere) but it's greedy: it eats
          // every horizontal drag on the screen — the drag-to-rate star slider, the
          // genre-chip / season-pill horizontal scrolls. Edge-only is the standard
          // iOS gesture and conflicts with none of them.
          gestureEnabled: true,
        }}
      >
        {/* The five bottom tabs switch via replace() (see BottomNav), so they're
            roots — not a back-stack. Kill their slide so a tab tap feels instant,
            not like pushing forward; pushed detail screens keep the default slide
            + swipe-back. */}
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="activity" options={{ animation: 'none' }} />
        <Stack.Screen name="search" options={{ animation: 'none' }} />
        <Stack.Screen name="profile/index" options={{ animation: 'none' }} />
        {/* Show Detail's four sub-tabs (Reviews/Overview/Seasons/Lists) REPLACE each
            other (see Tabs.tsx), so kill their slide too — switching tabs should feel
            instant, not like a page turn. The trade: arriving at the show from Home is
            also instant (no slide-in), consistent with the app's instant-tab feel. */}
        <Stack.Screen name="show/[id]/index" options={{ animation: 'none' }} />
        <Stack.Screen name="show/[id]/reviews" options={{ animation: 'none' }} />
        <Stack.Screen name="show/[id]/seasons" options={{ animation: 'none' }} />
        <Stack.Screen name="show/[id]/lists" options={{ animation: 'none' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ArchivoBlack_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      {/* ThemeProvider sits high so every screen + sheet can read the active
          palette. It owns the system/manual mode and persists the preference. */}
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RequireAuthProvider>
              {/* One global ShowActionSheet, opened by long-pressing any poster.
                  Inside RequireAuthProvider so its write actions can gate auth. */}
              <ShowSheetProvider>
                <AuthGate />
              </ShowSheetProvider>
            </RequireAuthProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
