// auth.tsx — AuthProvider + useAuth: manages the Supabase session lifecycle and exposes signIn/signUp/signOut.
import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { signInWithProvider, type OAuthProvider, type OAuthResult } from '@/lib/oauth';

// Result envelope for sign-in / sign-up. `error` = human-readable string,
// `needsConfirmation` = signup succeeded but Supabase is waiting on an email
// click before issuing a session (depends on dashboard auth settings).
type AuthResult = { error?: string; needsConfirmation?: boolean };

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  // OAuth (Google / Apple). The session arrives via onAuthStateChange just like
  // email auth, so callers only need the error/cancel envelope.
  signInWithOAuth: (provider: OAuthProvider) => Promise<OAuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore any persisted session from AsyncStorage on app boot.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Subscribe to future changes: sign-in, sign-out, token refresh, etc.
    // On identity change, blow away the query cache — user-scoped data
    // (mySocial) from a previous identity (anonymous or different user) is
    // wrong after sign-in/out. TOKEN_REFRESHED is the same identity, skip it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        // Scope to user-dependent queries only. `['show', id]` carries the
        // caller's mySocial rows, so it must refetch under a new identity.
        // `['popular']` is identity-independent — leave it cached.
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          queryClient.invalidateQueries({ queryKey: ['show'] });
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn: AuthState['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp: AuthState['signUp'] = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // No session returned = email confirmation is required (server-side setting).
    return { needsConfirmation: !data.session };
  };

  // Thin pass-through to the OAuth helper (kept in lib/oauth.ts so the
  // browser/redirect plumbing stays out of this provider). On success the helper
  // calls exchangeCodeForSession, which triggers onAuthStateChange → session set.
  const signInWithOAuth: AuthState['signInWithOAuth'] = (provider) => signInWithProvider(provider);

  const signOut: AuthState['signOut'] = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signIn, signUp, signInWithOAuth, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
