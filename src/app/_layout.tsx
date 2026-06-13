import { Stack, useRouter, useSegments } from 'expo-router';
import { View } from 'react-native';
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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider, useAuth } from '@/lib/auth';
import { RequireAuthProvider } from '@/lib/requireAuth';
import { ScopeSheetProvider } from '@/lib/scopeSheet';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { SheetGestureProvider, useAnySheetOpen } from '@/lib/sheetGesture';
import { BottomNav, type NavTab } from '@/components/BottomNav';
import { ProfilePrefetcher } from '@/components/ProfilePrefetcher';

// The persistent bottom nav lives at the root (mounted once, below the Stack)
// so it appears on EVERY screen instead of being pasted onto each one (PIL-14).
// Two route-derived questions decide how it renders:

// Which of the five tab roots is the current screen? Detail/browse pages map to
// null → the bar shows with nothing highlighted. `useSegments()` returns the
// file-based segments (e.g. ['show','[id]','review']), so matching is stable.
function activeTabForSegments(segments: string[]): NavTab | null {
  if (segments.length === 0) return 'home';        // '/' (app/index.tsx)
  if (segments[0] === 'activity') return 'activity';
  if (segments[0] === 'search') return 'search';
  if (segments[0] === 'profile') return 'profile'; // own profile + its sub-pages
  return null;
}

// Routes that should NOT show the nav (confirmed with Lucas — PIL-14): the
// logged-out auth flow, plus full-screen compose / edit / task flows that carry
// their own bottom action button (a nav under them = a clumsy double bar / a
// stray tap that abandons the task). Everything else — every browse + detail
// page — shows it.
const NAV_HIDDEN_ROUTES = new Set([
  'show/[id]/review',     // review composer (Save / Publish)
  'list/new',             // new + edit list (Save draft / Publish) — also hosts the "Add from show" picker
  'list/[id]/banner',     // choose-banner picker (a focused task screen)
  'profile/bulk-watched', // bulk mark-watched (confirm bar)
]);
function showNavForSegments(segments: string[]): boolean {
  if (segments[0] === '(auth)') return false; // welcome + signup (also logged out)
  return !NAV_HIDDEN_ROUTES.has(segments.join('/'));
}

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
  const anySheetOpen = useAnySheetOpen();
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

  const showNav = showNavForSegments(segments);
  const activeTab = activeTabForSegments(segments);

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
      {/* Warm the signed-in user's Profile (data + landing-tab posters) on launch
          so opening the Profile tab is instant. Renders nothing. */}
      <ProfilePrefetcher />
      {/* Stack fills the space ABOVE the in-flow nav; the nav (84px) sits flush at
          the bottom. Every screen that shows it uses SafeAreaView edges={['top']},
          so there's no double bottom inset. */}
      <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          // Edge-only swipe-back (start the drag from the LEFT EDGE). We tried
          // fullScreenGestureEnabled (swipe from anywhere) but it's greedy: it eats
          // every horizontal drag on the screen — the drag-to-rate star slider, the
          // genre-chip / season-pill horizontal scrolls. Edge-only is the standard
          // iOS gesture, and it coexists with the centered drag-to-rate slider
          // because RatingPicker uses react-native-gesture-handler: a touch that
          // begins ON the stars is claimed there, so UIKit's edge recognizer (which
          // only arms at touch-DOWN in the left edge) never fires for it. That's why
          // EVERY pushed screen keeps swipe-back — including the rating screens
          // (review composer, log, episode) — with no per-screen opt-outs.
          //
          // …and the edge gesture is still dropped while ANY sheet is open, so a drag
          // inside a sheet can never be stolen by a page-back — covers per-screen AND
          // the root-mounted (long-press / login) sheets.
          gestureEnabled: !anySheetOpen,
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
        {/* The rating screens (review composer, log, episode) used to set
            gestureEnabled:false out of a (mistaken) fear the drag-to-rate slider
            would trigger a page-back. The slider is CENTERED, so edge-only never
            overlaps it — they now inherit the default gesture above, like every
            other pushed screen. No per-screen opt-outs: any ‹ back arrow can be
            swiped back (Episode → Season → Seasons, review pages, log, …). */}
      </Stack>
      {showNav && <BottomNav active={activeTab} />}
      </View>
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
    // GestureHandlerRootView must wrap the whole app for react-native-gesture-handler
    // detectors to receive touches (the native <Stack>'s own edge-swipe works without
    // it, but our own GestureDetectors — e.g. the list picker's left-edge back-swipe —
    // do not). flex:1 so it fills the screen.
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      {/* ThemeProvider sits high so every screen + sheet can read the active
          palette. It owns the system/manual mode and persists the preference. */}
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* Above ALL sheets (incl. the root-mounted LoginSheet / long-press
                ShowActionSheet) AND the Stack, so any open sheet can drop the Stack's
                back-swipe — AuthGate reads the count. */}
            <SheetGestureProvider>
              <RequireAuthProvider>
                {/* One global scoped action sheet, opened by long-pressing any
                    poster (show scope) or episode row (episode scope). Inside
                    RequireAuthProvider so its write actions can gate auth. */}
                <ScopeSheetProvider>
                  <AuthGate />
                </ScopeSheetProvider>
              </RequireAuthProvider>
            </SheetGestureProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
