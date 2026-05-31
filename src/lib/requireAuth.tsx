// requireAuth.tsx — RequireAuthProvider + useRequireAuth: per-action auth gate that shows the LoginSheet and resolves a Promise true/false.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { LoginSheet } from '@/components/LoginSheet';

// requireAuth() returns a Promise so callers can `await` it before acting:
//   const allowed = await requireAuth();
//   if (!allowed) return;
//   ...mutation...
// Sync would short-circuit immediately on unauthed and the mutation would
// fire with no session.
type RequireAuthFn = () => Promise<boolean>;

const Ctx = createContext<RequireAuthFn | null>(null);

export function RequireAuthProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [visible, setVisible] = useState(false);

  // Queue of resolvers waiting on the sheet. Array (not single ref) so two
  // concurrent unauthed taps don't drop the first one's Promise.
  const pending = useRef<((b: boolean) => void)[]>([]);

  const requireAuth = useCallback<RequireAuthFn>(() => {
    if (session) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      pending.current.push(resolve);
      setVisible(true);
    });
  }, [session]);

  // Session arrived while sheet was open → resolve everyone with true.
  useEffect(() => {
    if (session && pending.current.length > 0) {
      pending.current.forEach((r) => r(true));
      pending.current = [];
      setVisible(false);
    }
  }, [session]);

  // User dismissed the sheet without signing in → resolve everyone with false.
  const onClose = () => {
    pending.current.forEach((r) => r(false));
    pending.current = [];
    setVisible(false);
  };

  return (
    <Ctx.Provider value={requireAuth}>
      {children}
      <LoginSheet visible={visible} onClose={onClose} />
    </Ctx.Provider>
  );
}

export function useRequireAuth(): RequireAuthFn {
  const fn = useContext(Ctx);
  if (!fn) throw new Error('useRequireAuth must be inside <RequireAuthProvider>');
  return fn;
}
