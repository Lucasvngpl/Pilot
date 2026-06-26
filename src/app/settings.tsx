// /settings — edit profile screen: avatar picker, username, display name, bio, and a sign-out button.
import { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useProfile, type ProfileData } from '@/api/useProfile';
import { useUpdateProfile, type ProfilePatch } from '@/api/useUpdateProfile';
import { uploadAvatar } from '@/lib/uploadAvatar';
import { TextField } from '@/components/TextField';
import { RichTextInput } from '@/components/RichTextInput';
import { Button } from '@/components/Button';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { sendFeedback } from '@/lib/feedback';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

const BIO_MAX = 160; // matches the DB `profiles_bio_len` check

export default function Settings() {
  const styles = useThemedStyles(makeStyles);
  const { colors, mode, setPref } = useTheme();
  const { user, signOut } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  const { data: profileData } = useProfile(userId);
  const { update, isPending } = useUpdateProfile(userId);

  const profile = profileData?.profile ?? null;
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Seed the form once from the loaded profile.
  useEffect(() => {
    if (profile && !seeded) {
      setUsername(profile.username ?? '');
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setSeeded(true);
    }
  }, [profile, seeded]);

  if (!user) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <NavBar />
        <Text style={styles.muted}>Sign in to edit your profile.</Text>
      </SafeAreaView>
    );
  }
  const uid = user.id; // user is non-null past the guard

  // Validate the username only when it CHANGED — existing (grandfathered) handles
  // may contain dots etc., so a bio-only edit shouldn't force a rename.
  const usernameChanged = seeded && username.trim() !== (profile?.username ?? '');
  const dirty =
    seeded &&
    (usernameChanged ||
      displayName.trim() !== (profile?.display_name ?? '').trim() ||
      bio.trim() !== (profile?.bio ?? '').trim());

  const onPickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Enable photo access to set an avatar.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const prevUrl = profile?.avatar_url ?? null;

    // Optimistic: show the picked image immediately while it uploads.
    qc.setQueryData<ProfileData>(['profile', uid], (d) =>
      d?.profile ? { ...d, profile: { ...d.profile, avatar_url: asset.uri } } : d,
    );
    setAvatarBusy(true);
    try {
      const publicUrl = await uploadAvatar(
        uid,
        {
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
        },
        prevUrl,
      );
      await update({ avatar_url: publicUrl });
    } catch (e) {
      // Roll back the optimistic image and surface the error.
      qc.setQueryData<ProfileData>(['profile', uid], (d) =>
        d?.profile ? { ...d, profile: { ...d.profile, avatar_url: prevUrl } } : d,
      );
      Alert.alert("Couldn't update avatar", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const onSave = async () => {
    if (!dirty || isPending) return;
    const trimmedUsername = username.trim();
    if (usernameChanged) {
      const err = validateUsername(trimmedUsername);
      if (err) { setUsernameError(err); return; }
    }
    setUsernameError(null);
    try {
      const patch: ProfilePatch = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      };
      if (usernameChanged) patch.username = trimmedUsername;
      await update(patch);
      router.back();
    } catch (e) {
      // The lower(username) unique index raises Postgres 23505 on a collision.
      if ((e as { code?: string })?.code === '23505') {
        setUsernameError('That username is taken.');
      } else {
        Alert.alert("Couldn't save", e instanceof Error ? e.message : 'Please try again.');
      }
    }
  };

  // After sign-out there's no user, so this screen would fall back to its dead
  // `!user` placeholder with no way out. Send the user to the same /welcome
  // landing screen BottomNav uses for anonymous users (PIL-21).
  const onSignOut = async () => {
    await signOut();
    router.replace('/welcome' as any);
  };

  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <NavBar />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarWrap}>
          <Pressable onPress={onPickAvatar} disabled={avatarBusy}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
            )}
            <View style={styles.avatarBadge}>
              {avatarBusy ? (
                // Spinner sits on the ink badge (which inverts to light in dark),
                // so it tracks `background` like the "Edit" label — not fixed white.
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={styles.avatarBadgeText}>Edit</Text>
              )}
            </View>
          </Pressable>
        </View>

        <TextField
          label="Username"
          value={username}
          onChangeText={(t) => { setUsername(t); if (usernameError) setUsernameError(null); }}
          placeholder="username"
          autoCapitalize="none"
        />
        <Text style={[styles.fieldHint, usernameError ? styles.fieldError : null]}>
          {usernameError ?? 'Letters, numbers, and underscores · 3–20 characters'}
        </Text>
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
        />
        {/* Rich text bio: bold/italic/indent/link via the keyboard toolbar
            (stored as the markdown subset). Keeps the 160-char cap + counter. */}
        <RichTextInput
          label="Bio"
          value={bio}
          onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
          placeholder="A little about you"
          maxLength={BIO_MAX}
          minHeight={90}
          rightAccessory={<Text style={styles.helper}>{bio.length}/{BIO_MAX}</Text>}
        />

        <View style={{ marginTop: 4 }}>
          <Button label="Update profile" onPress={onSave} disabled={!dirty} loading={isPending} />
        </View>

        {/* Appearance — Light / Dark only. The 'System' option was dropped (PIL-13):
            no need for an OS-follow choice in the picker. We highlight the EFFECTIVE
            `mode` (not the stored pref), so a user still on the legacy 'system'
            preference sees the right segment lit; tapping commits an explicit
            light/dark. The Profile header sun/moon is the matching 2-way quick flip. */}
        <View style={styles.appearanceSection}>
          <Text style={styles.sectionLabel}>Appearance</Text>
          <View style={styles.segment}>
            {(['light', 'dark'] as const).map((opt) => {
              const active = mode === opt;
              return (
                <Pressable
                  key={opt}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                  onPress={() => setPref(opt)}
                >
                  {/* Active item is ink-filled → label tracks `background` to stay
                      legible after the fill inverts in dark mode. */}
                  <Text style={[styles.segmentText, { color: active ? colors.background : colors.ink }]}>
                    {opt === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Library — bulk actions that populate your profile. */}
        <View style={styles.librarySection}>
          <Text style={styles.sectionLabel}>Library</Text>
          <Pressable style={styles.navRow} onPress={() => router.push('/profile/bulk-watched' as any)}>
            <Text style={styles.navRowLabel}>Mark shows watched</Text>
            <ChevronRightIcon color={colors.faint} size={20} />
          </Pressable>
        </View>

        {/* Feedback — opens an in-app mail composer to Lucas (mailto fallback). */}
        <View style={styles.librarySection}>
          <Text style={styles.sectionLabel}>Feedback</Text>
          <Pressable style={styles.navRow} onPress={sendFeedback}>
            <Text style={styles.navRowLabel}>Send feedback</Text>
            <ChevronRightIcon color={colors.faint} size={20} />
          </Pressable>
        </View>

        <View style={styles.signOutSection}>
          <Button label="Sign out" variant="secondary" onPress={onSignOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Format rule for new/edited handles (existing dotted handles are grandfathered —
// only validated when changed). Length first so the message is specific.
function validateUsername(u: string): string | null {
  if (u.length < 3 || u.length > 20) return 'Username must be 3–20 characters.';
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Use only letters, numbers, and underscores.';
  return null;
}

function NavBar() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.nav}>
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <ChevronLeftIcon color={colors.ink} size={24} />
      </Pressable>
      <Text style={[type.subhead, { color: colors.ink }]}>Edit profile</Text>
      <View style={{ width: 24 }} />
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
  body: { paddingHorizontal: pad, paddingTop: 8, paddingBottom: 40 },

  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    minWidth: 44,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    // The badge fill is `ink` (inverts to light in dark) — its ring + label must
    // invert too: a `background`-colored ring cuts it out of the avatar, and the
    // label flips to dark so it stays legible on the now-light badge.
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.background },

  helper: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint },
  fieldHint: {
    fontFamily: fonts.regular, fontSize: 12, color: colors.faint,
    marginTop: -8, marginBottom: 14, marginLeft: 2,
  },
  fieldError: { color: colors.red },

  librarySection: { marginTop: 28 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  navRowLabel: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },

  appearanceSection: { marginTop: 28 },
  sectionLabel: {
    fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginBottom: 8,
  },
  // iOS-style segmented control: a `field` track with the active segment lifted
  // out on an `ink` fill (which inverts in dark, like the other active controls).
  segment: { flexDirection: 'row', backgroundColor: colors.field, borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentItemActive: { backgroundColor: colors.ink },
  segmentText: { fontFamily: fonts.semibold, fontSize: 14 },

  signOutSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },

  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 28,
  },
});
