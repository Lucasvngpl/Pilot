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
import { useUpdateProfile } from '@/api/useUpdateProfile';
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
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Seed the form once from the loaded profile.
  useEffect(() => {
    if (profile && !seeded) {
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

  // Dirty-check on the form fields (avatar saves on its own, immediately).
  const dirty =
    seeded &&
    (displayName.trim() !== (profile?.display_name ?? '').trim() ||
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
    try {
      await update({ display_name: displayName.trim() || null, bio: bio.trim() || null });
      router.back();
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : 'Please try again.');
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
          value={profile?.username ?? ''}
          onChangeText={() => {}}
          editable={false}
          rightAccessory={<Text style={styles.helper}>Can&apos;t be changed yet</Text>}
        />
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
