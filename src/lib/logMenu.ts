import { router } from 'expo-router';
import { PencilSquareIcon, DraftIcon, ListPlusIcon } from '@/components/icons';
import { type MenuAction } from '@/components/ActionMenuSheet';

// The "+" log/list picker has TWO entry points — the bottom-nav Log tab and the
// Home FAB — but ONE definition lives here so they can't drift. Returns the
// rich rows (icon + title + subtitle) the ActionMenuSheet renders.
//
// `signedIn` gates "Continue a draft": drafts are own-only (RLS + own user id),
// so an anonymous user has none — surfacing it would just land them on an empty
// screen. Review/log and New list stay available to everyone (login is prompted
// per-action at the write, not here).
export function logMenuActions(signedIn: boolean): MenuAction[] {
  return [
    {
      label: 'Review or log',
      description: 'Search for a show to log',
      icon: PencilSquareIcon,
      onPress: () => router.push('/search?log=1' as any),
    },
    ...(signedIn
      ? [{
          label: 'Continue a draft',
          description: 'Pick up where you left off',
          icon: DraftIcon,
          onPress: () => router.push('/profile/drafts' as any),
        }]
      : []),
    {
      label: 'New list',
      description: 'Group shows into a list',
      icon: ListPlusIcon,
      onPress: () => router.push('/list/new' as any),
    },
  ];
}
