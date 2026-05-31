import { Slot, useRouter, useSegments } from 'expo-router';
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
import { queryClient } from '@/lib/queryClient';
import { AuthProvider, useAuth } from '@/lib/auth';
import { RequireAuthProvider } from '@/lib/requireAuth';

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
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (session && inAuthGroup) router.replace('/');
  }, [session, loading, segments]);

  // Hold the UI until the persisted session hydrates from AsyncStorage, so no
  // screen renders a signed-out view with a transiently-null session.
  if (loading) return null;

  return <Slot />;
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
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RequireAuthProvider>
            <AuthGate />
          </RequireAuthProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
