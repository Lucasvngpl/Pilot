// /profile/blocked — Blocked users (reached from Settings › Privacy). Lists every
// user you've blocked, each with an Unblock action. Own-only: the `blocks` RLS
// SELECT policy returns only YOUR block rows, so there's nothing to scope by hand.
// PIL-24.
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useBlockedUsers, useUnblockUser } from '@/api/blocks';
import { ChevronLeftIcon } from '@/components/icons';
import { type, pad, fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { BlockedUser } from '@/types';

export default function BlockedUsers() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: blocked, isLoading } = useBlockedUsers();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>Blocked users</Text>
        <View style={{ width: 24 }} />
      </View>

      {!user ? (
        <Text style={styles.muted}>Sign in to manage blocked users.</Text>
      ) : isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : !blocked || blocked.length === 0 ? (
        <Text style={styles.muted}>You haven&apos;t blocked anyone.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
          {blocked.map((b) => (
            <BlockedRow key={b.id} blocked={b} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function BlockedRow({ blocked }: { blocked: BlockedUser }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { unblock, isPending } = useUnblockUser();
  const name = blocked.display_name ?? blocked.username;

  return (
    <View style={styles.row}>
      {/* Tapping identity goes to their profile (which, while blocked, shows the
          "you've blocked this user" gate — consistent with the block everywhere). */}
      <Pressable style={styles.identity} hitSlop={4} onPress={() => router.push(`/user/${blocked.id}` as any)}>
        {blocked.avatar_url ? (
          <Image source={{ uri: blocked.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[type.reviewUser, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
          <Text style={[type.filter, { color: colors.muted }]} numberOfLines={1}>@{blocked.username}</Text>
        </View>
      </Pressable>
      <Pressable
        style={[styles.unblockBtn, isPending && { opacity: 0.5 }]}
        disabled={isPending}
        onPress={() => unblock(blocked.id)}
      >
        <Text style={[styles.unblockLabel, { color: colors.ink }]}>Unblock</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
    paddingVertical: 8,
  },
  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: pad,
    paddingVertical: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: pad,
    paddingVertical: 12,
  },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  unblockLabel: { fontFamily: fonts.semibold, fontSize: 13 },
});
