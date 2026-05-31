// /user/[id]/followers — list of users who follow this profile; delegates all rendering to FollowList.
import { useLocalSearchParams } from 'expo-router';
import { FollowList } from '@/components/FollowList';

export default function FollowersRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FollowList userId={id} kind="followers" />;
}
