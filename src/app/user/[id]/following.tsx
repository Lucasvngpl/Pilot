import { useLocalSearchParams } from 'expo-router';
import { FollowList } from '@/components/FollowList';

export default function FollowingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FollowList userId={id} kind="following" />;
}
