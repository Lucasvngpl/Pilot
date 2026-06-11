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
};

// Thin wrapper over the generic SegmentTabs — keeps the Profile call site and the
// ProfileTabKey type stable while sharing the row UI with Search. We deliberately
// don't pass `counts`: the Profile tabs read cleaner without number chips (PIL-5).
export function ProfileTabs({ active, onChange }: Props) {
  return <SegmentTabs tabs={PROFILE_TABS} active={active} onChange={onChange} />;
}
