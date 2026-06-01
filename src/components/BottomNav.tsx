import { useState } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { type, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { HomeIcon, ActivityIcon, LogIcon, SearchIcon, ProfileIcon } from '@/components/icons';
import { ActionMenuSheet } from '@/components/ActionMenuSheet';
import { useAuth } from '@/lib/auth';

export type NavTab = 'home' | 'activity' | 'log' | 'search' | 'profile';

// "Log" is NOT a route — its tap opens the log/list ActionMenuSheet (below), so
// the "+" works from every screen with the nav. Home (/), Search, Activity, and
// Profile navigate; Profile redirects unauthed users to /welcome to sign in.
const ITEMS: { tab: NavTab; label: string; href: string; Icon: React.ComponentType<{ color?: string; size?: number }> }[] = [
  { tab: 'home',     label: 'Home',     href: '/',         Icon: HomeIcon },
  { tab: 'activity', label: 'Activity', href: '/activity', Icon: ActivityIcon },
  { tab: 'log',      label: 'Log',      href: '/log',      Icon: LogIcon },
  { tab: 'search',   label: 'Search',   href: '/search',   Icon: SearchIcon },
  { tab: 'profile',  label: 'Profile',  href: '/profile',  Icon: ProfileIcon },
];

export function BottomNav({ active }: { active: NavTab }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { session } = useAuth();
  const [logMenuOpen, setLogMenuOpen] = useState(false);

  return (
    <>
      <View style={styles.bar}>
        {ITEMS.map(({ tab, label, href, Icon }) => {
          const isActive = active === tab;
          const color = isActive ? colors.ink : colors.navInactive;

          // Profile-when-unauthed is the only routing decision we make here.
          // '/welcome' = the auth landing (own URL so it doesn't collide with '/').
          const target = tab === 'profile' && !session ? '/welcome' : href;

          return (
            <Pressable
              key={tab}
              style={styles.item}
              onPress={() => {
                if (tab === 'log') { setLogMenuOpen(true); return; } // opens the menu, not a route
                // replace, not push: tabs are roots, so switching one shouldn't
                // stack onto the swipe-back history (you'd "swipe back" through
                // tabs). Detail screens still push (and gain swipe-back).
                router.replace(target as any);
              }}
            >
              <Icon color={color} size={24} />
              <Text style={[
                isActive ? type.navActive : type.navMuted,
                { color, marginTop: 3 },
              ]}>{label}</Text>
              {isActive && <View style={styles.activeBar} />}
            </Pressable>
          );
        })}
      </View>

      {/* "+" menu — pick a show to log/review, or start a new list. Rendered as a
          sibling of the bar so the Sheet overlay fills the screen, not the bar. */}
      <ActionMenuSheet
        visible={logMenuOpen}
        onClose={() => setLogMenuOpen(false)}
        actions={[
          { label: 'Review or log', onPress: () => router.push('/search?log=1' as any) },
          { label: 'New list', onPress: () => router.push('/list/new' as any) },
        ]}
      />
    </>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 84,
    // `surface`: the nav bar is an elevated chrome surface above the screen.
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: 10,
  },
  item: { flex: 1, alignItems: 'center' },
  // 24px ink rounded bar directly under the active label.
  activeBar: {
    width: 24, height: 3,
    borderRadius: 2,
    backgroundColor: colors.ink,
    marginTop: 4,
  },
});
