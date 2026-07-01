// share.ts — share a list via the native OS share sheet (no backend).
import { Share } from 'react-native';

// The shareable link for a list. Today it's the app's deep link — the app's
// `scheme` (pilot://) resolves `pilot://list/<id>` to the /list/[id] route. When
// a public WEB preview of lists exists, repoint this one function at the https
// URL and every Share button upgrades for free (default-with-override, same
// discipline as the list banner). Centralised so that's a one-line change, not a
// hunt through call sites.
export function listShareUrl(listId: string): string {
  return `pilot://list/${listId}`;
}

// Open the native share sheet with the list's title + link. NOT owner-gated —
// anyone viewing a public list can share it (good for reach).
export async function shareList(list: { id: string; title: string }): Promise<void> {
  const url = listShareUrl(list.id);
  try {
    await Share.share({
      // The link lives in the message text so Android (which ignores the `url`
      // field) still gets it; iOS detects it and offers link actions.
      message: `${list.title} — a list on Pilot\n${url}`,
      title: list.title, // iOS: email subject · Android: dialog title
    });
  } catch {
    // Share dismissed or failed — nothing to recover.
  }
}

// Deep link to a single review — same default-with-override discipline as
// listShareUrl: repoint this one function when a public web review URL exists.
export function reviewShareUrl(reviewId: string): string {
  return `pilot://review/${reviewId}`;
}

// Deep link to a specific COMMENT on a review or list. Resolves to the parent
// thread's route (pilot://review/<id> or pilot://list/<id>) with ?comment=<cid>
// so a future handler can scroll to it (scroll-to is deferred — the link already
// opens the right thread today). Same repoint-once discipline as the others.
export function commentShareUrl(
  targetType: 'review' | 'list',
  targetId: string,
  commentId: string,
): string {
  return `pilot://${targetType}/${targetId}?comment=${commentId}`;
}

// Share a review via the native sheet — "{who}'s review of {show} on Pilot" + the
// link. Not owner-gated; any published review is public, so anyone can share it.
export async function shareReview(review: {
  id: string;
  showName: string;
  username: string;
  display_name: string | null;
}): Promise<void> {
  const url = reviewShareUrl(review.id);
  const who = review.display_name ?? review.username;
  try {
    await Share.share({
      message: `${who}'s review of ${review.showName} on Pilot\n${url}`,
      title: `${review.showName} — review`,
    });
  } catch {
    // Share dismissed or failed — nothing to recover.
  }
}

// ----- Friend invite (growth loop) -----------------------------------------

// A personal invite link to a user's PROFILE. `?ref=invite` tells the profile
// screen to surface a one-tap follow prompt front-and-centre (closes step 5 of the
// growth loop — see CLAUDE.md "Sharing / self-growth loop"). The deep link resolves
// `pilot://user/<id>?ref=invite` to /user/[id]. Repoint at the https universal-link
// once a web landing exists (the install hook for recipients without the app yet).
export function inviteShareUrl(userId: string): string {
  return `pilot://user/${userId}?ref=invite`;
}

type InviteProfile = { id: string; username: string; display_name: string | null };

// The invite copy, in one place so the share sheet AND the per-contact SMS path
// (onboarding AddFriendsStep) send the identical message. Carries Pilot's mark +
// an install hook so a recipient without the app knows what it is and where to get
// it (closes step 4 of the growth loop).
export function inviteMessage(profile: InviteProfile): string {
  const who = profile.display_name ?? profile.username;
  return (
    `Follow ${who} on Pilot — track, rate & review every show and episode you watch.\n` +
    `${inviteShareUrl(profile.id)}\n\n` +
    `Don't have Pilot yet? Get it: https://pilot.app`
  );
}

// Open the native share sheet with a personal invite (socials / DMs — the user
// picks the app). `who` = the sharer's display name / handle.
export async function shareInvite(profile: InviteProfile): Promise<void> {
  try {
    await Share.share({ message: inviteMessage(profile), title: 'Join me on Pilot' });
  } catch {
    // Share dismissed or failed — nothing to recover.
  }
}
