// /user/[id]/following — list of users this profile follows; delegates all rendering to FollowList.
import { useLocalSearchParams } from 'expo-router';
import { FollowList } from '@/components/FollowList';

export default function FollowingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FollowList userId={id} kind="following" />;
}
