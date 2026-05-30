import { ComingSoonScreen } from '@/components/ComingSoonScreen';

// Diary = the chronological, date-grouped view of everything watched (one entry
// per watched episode, keyed off watch_status.updated_at). Built from existing
// data — no schema change — when we get to it.
export default function Diary() {
  return (
    <ComingSoonScreen
      title="Diary"
      message="Your watch diary — a date-by-date log of everything you've watched — is coming soon."
    />
  );
}
