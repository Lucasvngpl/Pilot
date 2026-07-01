// oauth.ts — Google / Apple sign-in via Supabase Auth, using the PKCE flow over
// a system browser. This is the OAuth-primary path for onboarding + the login sheet.
//
// How OAuth works on a phone (no URL bar to read the redirect):
//   1. supabase.auth.signInWithOAuth() builds the provider's consent URL but,
//      with skipBrowserRedirect, hands it back to US instead of navigating.
//   2. WebBrowser.openAuthSessionAsync() opens that URL in a secure in-app
//      browser tab (SFSafariViewController on iOS / Custom Tab on Android) and
//      RESOLVES when the provider redirects back to our app's deep link
//      (redirectTo). That deep link carries a one-time `?code=...`.
//   3. PKCE: we trade that code for a real session with exchangeCodeForSession().
//      The supabase client (configured flowType:'pkce') kept the matching code
//      verifier in AsyncStorage, so the exchange is bound to THIS device.
//
// On success the client stores the session and fires onAuthStateChange('SIGNED_IN'),
// which AuthProvider observes — so requireAuth() promises resolve and the UI updates.
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

// Dismisses a leftover auth browser tab if one is somehow still open when the app
// resumes. Documented one-time call; a no-op on the happy path.
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';

// `cancelled` is distinct from `error` so callers can stay silent when the user
// simply backed out of the provider sheet (no scary error toast for a deliberate
// cancel — see the onboarding sign-in step).
export type OAuthResult = { error?: string; cancelled?: boolean };

// The deep link the provider redirects back to. We HARDCODE the app-scheme URL
// (app.json → scheme "pilot") instead of Linking.createURL('auth-callback') on
// purpose:
//   • This exact string must match Supabase → Authentication → URL Configuration →
//     Redirect URLs. If it doesn't, GoTrue silently falls back to the Site URL
//     (default http://localhost:3000) — which is the "Safari can't connect to
//     localhost" dead-end we hit.
//   • createURL() is environment-dependent: in a dev client it returns a Metro-host
//     URL like exp://172.20.0.109:8081/--/auth-callback (the LAN IP even changes
//     between networks), so it can never be reliably allowlisted.
//   • OAuth only works in a dev/standalone build anyway (Expo Go's scheme is exp://,
//     which can't receive a pilot:// redirect), and both dev + standalone register
//     the "pilot" scheme — so a fixed pilot:// URL is correct everywhere OAuth runs.
const redirectTo = 'pilot://auth-callback';

export async function signInWithProvider(provider: OAuthProvider): Promise<OAuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        // We open the browser ourselves (step 2) instead of letting supabase-js
        // try a web-style location change, which doesn't exist in React Native.
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'Could not start sign-in. Please try again.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    // User dismissed the browser tab without finishing — not an error.
    if (result.type !== 'success') return { cancelled: true };

    // The redirect deep link looks like pilot://auth-callback?code=XXXX (or
    // ?error=access_denied if the user denied consent on the provider screen).
    const { queryParams } = Linking.parse(result.url);
    const providerError = queryParams?.error_description ?? queryParams?.error;
    if (providerError) {
      return { error: Array.isArray(providerError) ? providerError[0] : String(providerError) };
    }
    const code = queryParams?.code;
    const codeStr = Array.isArray(code) ? code[0] : code;
    if (!codeStr) return { error: 'Sign-in did not complete. Please try again.' };

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(codeStr);
    if (exchangeError) return { error: exchangeError.message };
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Sign-in failed. Please try again.' };
  }
}
