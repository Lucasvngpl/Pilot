# Pilot — Design Spec (Addendum: Auth + Profile)

> Companion to `PILOT_DESIGN_SPEC.md`. Same rules: values extracted directly from the Figma file, exact not approximate. Frame 393 × 852, background #FFFFFF. Reuses the token names from the base spec (`ink`, `purple`, `muted`, `faint`, `hairline`, `cream`, etc.). New tokens noted below.

## New / confirmed tokens

```ts
// add to theme.ts
field:    '#F5F5F2',   // input field bg, disabled-button bg, dashed-slot fill
dashStroke:'#CCCCC9',  // dashed empty-slot border + slot number
scrim:    'rgba(26,26,24,0.45)',  // dim backdrop behind bottom sheets
```

Side margin: Auth/Login use **24px** (PAD=24); Profile uses **20px** (PAD=20), matching the other main screens.

---

## Screen 4 — Auth Landing

Centered, single column, PAD 24. Top to bottom:

1. **Status bar** (time left).
2. **Wordmark** "PILOT" — Archivo Black 20, ink, tracking +3, centered, ~72px from top.
3. **Illustration slot** — 180×180, radius 24, fill `cream` (#F5F2E8), centered. **Placeholder** for a custom hand-drawn TV character (Procreate). Until then, a simple line-art TV (ink stroke 3) with a `purple` power-dot.
4. **Headline** (left-aligned, PAD 24, starts ~440px): two lines, Archivo Black 34, lineHeight 38, tracking −0.5.
   - Line 1: "Track every" (ink).
   - Line 2: a purple highlight chip — rounded rect radius 8, fill `purple`, padding L/R 10 / T2 B4 — containing "show" in white Archivo Black 34, followed by " you watch." in ink. (This is the Record-Club "highlight one word" move.)
5. **Subhead** — Inter Regular 15, `muted`, lineHeight 21, full width: "Rate, review, and share what you're watching with friends."
6. **Primary button** "Sign up free" — full-width (W−48), 54px tall, radius 12, fill `ink`, text Inter SemiBold 16 white, centered.
7. **Secondary button** "Log in" — same size, fill white, 1px `hairline` border, text Inter SemiBold 16 ink.
8. **Legal line** — Inter Regular 12, `faint`, centered, lineHeight 17: "By continuing, you agree to Pilot's Terms of Use and Privacy Policy."

Behavior: "Sign up free" → sign-up; "Log in" → Login Sheet (Screen 4b). Email-only for v1.

---

## Screen 4b — Login Sheet (bottom sheet over dimmed landing)

1. **Scrim**: full-screen `scrim` over a faint preview of the landing (wordmark ghosted at ~25% opacity). Status-bar time in white over the scrim.
2. **Sheet**: bottom-anchored, height ~560, fill white, top corners radius 24.
   - **Grabber**: 40×5, radius 3, `hairline`, centered, ~12px from sheet top.
   - **Title** "Log in to Pilot" — Inter Bold 18, ink, centered.
   - **Email field**: label "Email" Inter Medium 13 ink; box W−48 × 52, radius 12, fill `field`; placeholder "Enter your email address" Inter Regular 15 `faint`.
   - **Password field**: label "Password" (left) + "Forgot password?" Inter SemiBold 13 `purple` (right); same box; placeholder "Enter your password".
   - **Log in button**: W−48 × 54, radius 12. **Disabled/empty state** = fill `field`, text `faint`. Enabled state = fill `ink`, text white (mirror the Auth primary button).
   - **"or" divider**: two `hairline` rules with "or" Inter Regular 12 `faint` centered between.
   - **Continue with Apple**: outlined button (white fill, hairline border), Inter SemiBold 16 ink. **OPTIONAL / FUTURE — do not ship in v1** (adding it triggers App Store sign-in requirements). Shown in mock as a future option only.

---

## Screen 5 — Profile

PAD 20. Vertical scroll. Top to bottom:

1. **Status bar.**
2. **Top action row** (~54px): share icon (left, ink stroke 1.8), theme/settings gear (right). On someone else's profile this row is where a **Follow button** goes instead (see follows note).
3. **Identity block**:
   - Username "lucasvngpl" — Archivo Black 26, ink, tracking −0.3.
   - Counts row (below): "128" Inter Bold 14 ink + "Following" Inter Regular 14 `muted`, gap, "94" + "Followers". **Empty/first-run state: "0 Following  0 Followers".**
   - Avatar: 72px circle, right-aligned, top ~96px. Placeholder fill until real image.
4. **Profile tab row** (horizontal, scrollable, gap 22): Profile (active: Inter Bold 15 ink + 54px ink underline bar), Activity, Watched [42], Diary [8], Reviews [12] (inactive: Inter Medium 15 `muted`, count chips Inter Bold 10 `muted` on `hairline`). Full-width `hairline` under.
5. **"Your Top 5"** — Archivo Black 20 ink (left) + "Edit" Inter SemiBold 14 `purple` (right). Below: horizontal row of **dashed empty slots**, 98×132, radius 8, fill `field`, 1.5px `dashStroke` dashed border (dash 5 / gap 4), centered slot number Inter Bold 18 `dashStroke`. (Filled state: replace with show poster.)
6. **"Currently watching"** — Archivo Black 20 ink + "Edit" `purple`. Below: horizontal poster shelf, posters 112×166. Each poster has a **watched-check overlay**: 22px `purple` circle, bottom-left inset ~8px, white check inside. Under each: show name Inter SemiBold 13 ink + episode "S2 E5" Inter Regular 12 `muted`.
7. **Bottom nav** — Profile active (ink icon + label + 24px ink bar), others `navInactive`.

---

## Follows (asymmetric — confirmed v1 model)

- The `follows` table already exists (Phase A). Following = single insert: `{follower_id: auth.uid(), followee_id: target}`. Unfollow = delete that row. No approval, no status column — asymmetric like Letterboxd/Record Club.
- On your **own** profile: top-right shows share + settings. On **another user's** profile: show a **Follow / Following toggle button** there instead (Following state = filled ink or outlined; pick to match the secondary-button style). 
- `useFollow` / `useUnfollow` mutations invalidate the followee's follower-count query + the follow-state query on success. Optimistic update is nice-to-have (flip the button instantly, roll back on error).
- Counts ("Following" / "Followers") are `count(*)` queries on `follows` filtered by `follower_id` / `followee_id`.

---

## Not mocked — build from patterns (no Figma frame)

Search/Discover, the +/Log action sheet, search-to-log modal, and Create List are standard patterns. Build from the reference screenshots + existing components (`Tabs`, `Poster`, list rows, `theme.ts`). The review composer reached via Log must include a **scope selector** (whole show / season / episode) since the `reviews` table supports all three.
