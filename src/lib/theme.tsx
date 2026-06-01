// Theme runtime — resolves the active palette (light/dark) and exposes it to the
// tree so colors are read at RENDER time, not baked into module-level styles.
//
// Why a context/hook instead of `import { colors }`: StyleSheet.create copies a
// color's string value once, at module load. To switch themes *live* (no reload),
// components must re-read colors when the mode changes — which only a render-time
// source (React context) can drive. See src/theme.ts for the token model.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, type Palette } from '@/theme';

// 'system' defers to the OS; 'light'/'dark' are explicit manual overrides.
export type ThemePref = 'light' | 'dark' | 'system';
export type ThemeMode = 'light' | 'dark'; // the RESOLVED mode (system collapsed)

// Per-device, mirrors the AsyncStorage pattern in src/lib/useRecentSearches.ts.
const STORAGE_KEY = 'pilot.themePref.v1';

type ThemeContextValue = {
  colors: Palette;              // the active palette (what components consume)
  mode: ThemeMode;              // resolved mode after collapsing 'system'
  pref: ThemePref;              // the stored preference (drives the Settings control)
  setPref: (p: ThemePref) => void;
  hydrated: boolean;            // AsyncStorage read finished (gate first paint on this)
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();              // 'light' | 'dark' | null (web/unknown)
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [hydrated, setHydrated] = useState(false);

  // Load the persisted preference once on mount. Until this resolves we hold the
  // UI (see hydrated gate in _layout) so a forced theme doesn't flash the OS theme.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive) return;
        if (raw === 'light' || raw === 'dark' || raw === 'system') setPrefState(raw);
        setHydrated(true);
      })
      .catch(() => {
        if (alive) setHydrated(true); // storage error → fall back to 'system'
      });
    return () => {
      alive = false;
    };
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {}); // fire-and-forget persist
  }, []);

  // Resolve the preference against the OS. useColorScheme() can also report
  // 'unspecified'/null (web/unknown) → treat anything that isn't 'dark' as light.
  const systemMode: ThemeMode = system === 'dark' ? 'dark' : 'light';
  const mode: ThemeMode = pref === 'system' ? systemMode : pref;
  // One of two STABLE module objects → identity only changes on a real mode switch,
  // so useThemedStyles' memo rebuilds StyleSheets only then (not every render).
  const colors = mode === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ colors, mode, pref, setPref, hydrated }),
    [colors, mode, pref, setPref, hydrated],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/**
 * Build a themed StyleSheet from a factory. Replaces a module-level
 * `const styles = StyleSheet.create({...})` with:
 *
 *   const styles = useThemedStyles(makeStyles);
 *   ...
 *   const makeStyles = (colors: Palette) => StyleSheet.create({ ... colors.x ... });
 *
 * The factory must be a stable module-scope function (defined once, not inline),
 * so the memo key is really just the palette — the sheet rebuilds only on switch.
 */
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
