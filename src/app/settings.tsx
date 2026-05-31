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
import { Button } from '@/components/Button';
import { ChevronLeftIcon } from '@/components/icons';
import { colors, type, pad, fonts } from '@/theme';

const BIO_MAX = 160; // matches the DB `profiles_bio_len` check

export default function Settings() {
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
                <ActivityIndicator color={colors.white} size="small" />
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
        <TextField
          label="Bio"
          value={bio}
          onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
          placeholder="A little about you"
          multiline
          maxLength={BIO_MAX}
          rightAccessory={<Text style={styles.helper}>{bio.length}/{BIO_MAX}</Text>}
        />

        <View style={{ marginTop: 4 }}>
          <Button label="Update profile" onPress={onSave} disabled={!dirty} loading={isPending} />
        </View>

        <View style={styles.signOutSection}>
          <Button label="Sign out" variant="secondary" onPress={signOut} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
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
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },

  helper: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint },
  fieldHint: {
    fontFamily: fonts.regular, fontSize: 12, color: colors.faint,
    marginTop: -8, marginBottom: 14, marginLeft: 2,
  },
  fieldError: { color: colors.red },

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
