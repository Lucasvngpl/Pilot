import { useLocalSearchParams } from 'expo-router';
import { ProfileView } from '@/components/ProfileView';

// Another user's profile. Public — no auth wall (only the Follow tap gates auth,
// inside ProfileView). ProfileView handles the self-vs-other + follow-button
// logic internally via variant='other'.
export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfileView userId={id} variant="other" />;
}
