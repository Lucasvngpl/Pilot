import { SegmentTabs, type SegmentTab } from '@/components/SegmentTabs';

export type ProfileTabKey = 'profile' | 'shows' | 'lists' | 'watchlist';

const PROFILE_TABS: SegmentTab<ProfileTabKey>[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'shows', label: 'Shows' },
  { key: 'lists', label: 'Lists' },
  { key: 'watchlist', label: 'Watchlist' },
];

type Props = {
  active: ProfileTabKey;
  onChange: (key: ProfileTabKey) => void;
  counts?: Partial<Record<ProfileTabKey, number>>;
};

// Thin wrapper over the generic SegmentTabs — keeps the Profile call site and the
// ProfileTabKey type stable while sharing the row UI with Search.
export function ProfileTabs({ active, onChange, counts }: Props) {
  return <SegmentTabs tabs={PROFILE_TABS} active={active} onChange={onChange} counts={counts} />;
}
