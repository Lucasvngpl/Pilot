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

// Open the native share sheet with a personal invite. The message carries Pilot's
// mark + an install hook so a recipient who doesn't have the app yet knows what it
// is and where to get it (step 4). `who` = the sharer's display name / handle.
export async function shareInvite(profile: {
  id: string;
  username: string;
  display_name: string | null;
}): Promise<void> {
  const url = inviteShareUrl(profile.id);
  const who = profile.display_name ?? profile.username;
  try {
    await Share.share({
      message:
        `Follow ${who} on Pilot — track, rate & review every show and episode you watch.\n` +
        `${url}\n\n` +
        `Don't have Pilot yet? Get it: https://pilot.app`,
      title: 'Join me on Pilot',
    });
  } catch {
    // Share dismissed or failed — nothing to recover.
  }
}
