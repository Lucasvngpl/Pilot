import { useLocalSearchParams } from 'expo-router';
import { ProfileView } from '@/components/ProfileView';

// Another user's profile. Public — no auth wall (only the Follow tap gates auth,
// inside ProfileView). ProfileView handles the self-vs-other + follow-button
// logic internally via variant='other'.
//
// `?ref=invite` = opened from a shared invite deep link (lib/share.inviteShareUrl):
// the recipient lands on the SHARER'S profile with a prominent follow prompt, not a
// generic home screen (growth-loop step 5).
export default function UserProfile() {
  const { id, ref } = useLocalSearchParams<{ id: string; ref?: string }>();
  return <ProfileView userId={id} variant="other" invite={ref === 'invite'} />;
}
