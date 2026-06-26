// Onboarding step 4 (post sign-in) — "Find your friends". Two paths:
//   1. Share a personal invite link (socials / DMs) → opens the SHARER'S profile
//      with a follow prompt (the growth loop). Needs the signed-in profile, which
//      is why this step runs AFTER the sign-in gate.
//   2. Invite from contacts (native only) → read the address book and send each
//      contact an invite (SMS when there's a number, else the OS share sheet).
//
// MATCHING GAP (documented in the PR): `profiles` has no phone/email column, so we
// CANNOT match a contact to an existing Pilot user to offer "Follow". Every contact
// gets an INVITE (install) action, not a follow. Real matching needs a hashed-phone
// index we don't have yet — see the PR description.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import * as Contacts from 'expo-contacts';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/api/useProfile';
import { shareInvite, inviteMessage } from '@/lib/share';
import { Button } from '@/components/Button';
import { fonts, pad, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type ContactLite = { id: string; name: string; phone: string | null };
// 'idle' = haven't asked yet · 'loading' = permission/read in flight ·
// 'denied' = permission refused · 'ready' = contacts loaded.
type SyncState = 'idle' | 'loading' | 'denied' | 'ready';

export function AddFriendsStep() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: profileData } = useProfile(user?.id);

  const [sync, setSync] = useState<SyncState>('idle');
  const [contacts, setContacts] = useState<ContactLite[]>([]);

  // The signed-in profile feeds the invite link. Fall back to the handle while the
  // profile row loads (it's fast — direct read on launch).
  const inviteProfile = {
    id: user?.id ?? '',
    username: profileData?.profile?.username ?? 'me',
    display_name: profileData?.profile?.display_name ?? null,
  };

  // Ask for Contacts permission, then read names + first phone number. All native-
  // only — the button that calls this is hidden on web (Contacts is unavailable there).
  const syncContacts = async () => {
    setSync('loading');
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      setSync('denied');
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
    });
    const lite: ContactLite[] = data
      .filter((c) => !!c.name)
      .map((c) => ({
        id: c.id ?? c.name!,
        name: c.name!,
        phone: c.phoneNumbers?.[0]?.number ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      // Cap the rendered list — these are plain rows in a ScrollView (no
      // virtualization), and the primary path is the share link above anyway.
      .slice(0, 100);
    setContacts(lite);
    setSync('ready');
  };

  // Invite ONE contact. SMS pre-addressed to their number when we have it (lowest
  // friction); otherwise the OS share sheet. iOS/Android differ on the sms body
  // separator (`&` vs `?`).
  const inviteContact = async (c: ContactLite) => {
    if (c.phone) {
      const sep = Platform.OS === 'ios' ? '&' : '?';
      const url = `sms:${c.phone.replace(/\s+/g, '')}${sep}body=${encodeURIComponent(inviteMessage(inviteProfile))}`;
      const canOpen = await Linking.canOpenURL(url).catch(() => false);
      if (canOpen) {
        Linking.openURL(url);
        return;
      }
    }
    await shareInvite(inviteProfile);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Find your friends</Text>
        <Text style={styles.subtitle}>
          Pilot is better with friends — see their reviews and what they&apos;re watching.
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        <Button label="Share my invite link" onPress={() => shareInvite(inviteProfile)} />

        {/* Contacts is native-only; on web we offer just the share link above. */}
        {Platform.OS !== 'web' && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionLabel}>From your contacts</Text>

            {sync === 'idle' && (
              <Button
                label="Invite from contacts"
                variant="secondary"
                onPress={syncContacts}
              />
            )}
            {sync === 'loading' && <Text style={styles.muted}>Loading contacts…</Text>}
            {sync === 'denied' && (
              <Text style={styles.muted}>
                Contacts access is off. You can still share your invite link above, or enable
                Contacts for Pilot in Settings.
              </Text>
            )}
            {sync === 'ready' && contacts.length === 0 && (
              <Text style={styles.muted}>No contacts found.</Text>
            )}
            {sync === 'ready' &&
              contacts.map((c) => (
                <View key={c.id} style={styles.row}>
                  <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Pressable style={styles.invitePill} onPress={() => inviteContact(c)}>
                    <Text style={styles.invitePillText}>Invite</Text>
                  </Pressable>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: { paddingHorizontal: pad, paddingTop: 4, paddingBottom: 12 },
    title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.5 },
    subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, marginTop: 8, lineHeight: 21 },
    body: { paddingHorizontal: pad, paddingTop: 8, paddingBottom: 24 },
    sectionLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginBottom: 12 },
    muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, lineHeight: 20, paddingVertical: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.hairline,
      gap: 12,
    },
    name: { flex: 1, fontFamily: fonts.medium, fontSize: 15 },
    invitePill: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.purple,
    },
    invitePillText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.white },
  });
