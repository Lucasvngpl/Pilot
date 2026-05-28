import { View, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, type } from '@/theme';
import { HomeIcon, ActivityIcon, LogIcon, SearchIcon, ProfileIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth';

export type NavTab = 'home' | 'activity' | 'log' | 'search' | 'profile';

// Routes for Activity / Log / Search don't exist yet — tapping them currently
// 404s. Home (/) and Profile (/profile) work; Profile additionally redirects
// unauthed users to /(auth) so they can sign in.
const ITEMS: { tab: NavTab; label: string; href: string; Icon: React.ComponentType<{ color?: string; size?: number }> }[] = [
  { tab: 'home',     label: 'Home',     href: '/',         Icon: HomeIcon },
  { tab: 'activity', label: 'Activity', href: '/activity', Icon: ActivityIcon },
  { tab: 'log',      label: 'Log',      href: '/log',      Icon: LogIcon },
  { tab: 'search',   label: 'Search',   href: '/search',   Icon: SearchIcon },
  { tab: 'profile',  label: 'Profile',  href: '/profile',  Icon: ProfileIcon },
];

export function BottomNav({ active }: { active: NavTab }) {
  const { session } = useAuth();

  return (
    <View style={styles.bar}>
      {ITEMS.map(({ tab, label, href, Icon }) => {
        const isActive = active === tab;
        const color = isActive ? colors.ink : colors.navInactive;

        // Profile-when-unauthed is the only routing decision we make here;
        // everything else uses the static href.
        const target = tab === 'profile' && !session ? '/(auth)' : href;

        return (
          <Pressable
            key={tab}
            style={styles.item}
            onPress={() => router.push(target as any)}
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
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 84,
    backgroundColor: colors.white,
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
