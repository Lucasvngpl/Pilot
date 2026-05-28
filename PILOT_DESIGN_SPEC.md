# Pilot — Design Spec (exact, extracted from Figma)

> Source of truth for `theme.ts` and all three screens. Every value here was read directly from the Pilot Figma file — these are exact, not approximations. Frame size for all screens: **393 × 852** (iPhone logical points). Background: **#FFFFFF**.

---

## theme.ts — tokens

```ts
export const colors = {
  ink:        '#1A1A18',   // primary text, active nav, season-pill active bg
  white:      '#FFFFFF',   // screen bg, text on dark fills
  muted:      '#737370',   // secondary text (creator, runtime, meta)
  faint:      '#9E9E9C',   // tertiary text (labels, kickers, ep numbers unwatched)
  navInactive:'#B3B3B3',   // bottom-nav inactive labels/icons
  hairline:   '#E5E5E3',   // dividers, unchecked circles, inactive chip bg
  purple:     '#6B45DB',   // single accent: active chip, watched check, FAB, rating stars, "Mark all watched"
  gold:       '#F0A521',   // avg-rating star (warm/rounded)
  green:      '#298C54',   // "FRESH" tag
  red:        '#D9332A',   // popularity trend arrow
  cream:      '#F5F2E8',   // recreated-poster base (The Bear)
  posterBlue: '#2E5C9E',   // recreated-poster apron band (The Bear)
};

export const fonts = {
  display: 'Archivo Black',  // titles, wordmark, section headers, poster text
  sans:    'Inter',          // everything else (Regular / Medium / SemiBold / Bold)
};

export const radius = { sm: 4, md: 6, pill: 20, full: 999 };
export const pad = 20;  // editorial side margin on every screen
```

> Note: stars currently render in purple (`#6B45DB`) in the review rows but gold (`#F0A521`) in the stat row. The gold rounded star is the intended treatment for ratings — unify on gold when building. The purple stars in review rows were an earlier pass.

---

## Type styles (font / size / color) — exact

| Use | Font | Size | Color |
|---|---|---|---|
| Wordmark "PILOT" / "Popular in Community" | Archivo Black | 19 | ink |
| Screen title "THE BEAR" (Show Detail) | Archivo Black | 40 | ink |
| Section header (Home) "Popular Shows This Week" | Archivo Black | 22 | ink |
| Compact title (Seasons) | Archivo Black | 26 | ink |
| Status bar / time | Inter SemiBold | 15 | ink |
| Kicker "COMEDY-DRAMA · " | Inter SemiBold | 11 | faint |
| "FRESH" tag | Inter Bold | 11 | green |
| Creator "Christopher Storer" | Inter Regular | 17 | muted |
| Stat value "4.6" | Inter Bold | 17 | ink |
| Stat label "AVG RATING" | Inter SemiBold | 10 | faint |
| Tab active "Reviews" | Inter Bold | 15 | ink |
| Tab inactive "Overview" | Inter Medium | 15 | muted |
| Tab count chip (active) | Inter Bold | 10 | white (on purple) |
| Tab count chip (inactive) | Inter Bold | 10 | muted (on hairline) |
| Section subhead "Popular Reviews ›" | Inter Bold | 16 | ink |
| Filter "Everyone ⌄" | Inter Medium | 13 | muted |
| Review username "maya" | Inter SemiBold | 13 | ink |
| Review show title | Inter Bold | 15 | ink |
| Review season line "Season 2 · Forks" | Inter Regular | 13 | muted |
| Review body | Inter Regular | 14 | ink |
| Review meta "♡ 127 likes" | Inter Medium | 12 | muted |
| Season pill active "Season 2" | Inter SemiBold | 13 | white (on ink) |
| Season pill inactive "Season 1" | Inter Medium | 13 | ink (on white, hairline border) |
| "Mark all watched" | Inter SemiBold | 13 | purple |
| Episode runtime "46m" | Inter Regular | 12 | muted |
| Episode rating "4.5" | Inter Medium | 12 | muted |
| Episode number (unwatched) | Inter Bold | 15 | faint |
| Episode number (watched) | Inter Bold | 15 | ink |
| Friend username (Home) | Inter SemiBold | 12 | ink |
| Bottom-nav active "Home" | Inter SemiBold | 11 | ink |
| Bottom-nav inactive "Activity" | Inter Medium | 11 | navInactive |

---

## Screen 1 — Show Detail (Reviews tab active)

Vertical scroll. Top to bottom:

1. **Status bar** (time left, signal/wifi/battery right).
2. **Nav row**: back chevron `‹` (left); right cluster: "0% watched" (faint) + options `•••`.
3. **Poster hero**: centered, ~152×225, radius 6. (Real app: TMDb poster image. Placeholder: cream bg, red Archivo Black title, blue apron band.)
4. **Kicker row** (centered): "COMEDY-DRAMA · " (faint) + "FRESH" (green).
5. **Title** "THE BEAR" — Archivo Black 40, ink, centered.
6. **Creator** "Christopher Storer" — Inter Regular 17, muted, centered.
7. **Stat row** (centered, 3 cols, ~34px gap): gold rounded ★ + "4.6" / "AVG RATING"; overlapping avatar cluster (4 circles, ~15px, 10px step, white stroke) + "1.2k" / "VIEWERS"; red trend-up arrow + "94" / "POPULARITY". Labels Inter SemiBold 10 faint.
8. **Tabs** (left-aligned, 22px gap): Reviews [248] active (ink + purple chip + ink underline bar), Overview, Seasons [4], Lists [31] inactive. Full-width hairline under.
9. **Popular Reviews header**: "Popular Reviews ›" (left) / "Everyone ⌄" (right).
10. **Review rows** (repeating): avatar+username / `•••`; then [text column: show title, season line, rating stars, body] + poster thumb (46×64) on right; then meta "♡ N likes  ⌯ Comment". Hairline between rows.
11. **Bottom nav** (pinned, 84px): Home(active) Activity Log Search Profile.

---

## Screen 2 — Seasons (Seasons tab active)

1. Status bar.
2. Nav row: `‹` / "0% watched" + `•••`.
3. **Compact header** (horizontal): mini poster (58×86) + [title "THE BEAR" Archivo Black 26 + sub-row: gold star + "4.6" + "· 4 seasons · 38 episodes" muted].
4. **Tabs**: same set, Seasons active now.
5. **Season pills** (horizontal, 8px gap): rounded (radius 20), active = ink bg / white text, inactive = white bg / ink text / hairline border. S2 active.
6. **Season meta row**: "10 episodes · 2023" (muted, left) / "Mark all watched ✓" (purple, right). Hairline under.
7. **Episode rows** (repeating): ep number (left, 20px, ink if watched / faint if not) + [title Inter SemiBold 15 + sub: runtime · gold star + rating] + watched circle (24px, right): watched = purple fill + white check, unwatched = hairline stroke only. Hairline between rows.
8. Bottom nav.

---

## Screen 3 — Home

Vertical scroll. NOT horizontal shelves — it's section headers with poster rows.

1. Status bar.
2. **Top bar**: hamburger (left) + "Popular in Community" (Archivo Black 19). [Earlier version had PILOT wordmark + clock/bell — current build uses the hamburger + title; match the current file.]
3. **Section: "Popular Shows This Week"** (Archivo Black 22) → horizontal row of posters (~118×176), no labels under.
4. **Section: "New From Friends"** (Archivo Black 22) → horizontal row of posters, each WITH a row under it: avatar (20px) + [username Inter SemiBold 12 + that friend's star rating in gold].
5. **FAB**: purple circle (58px, radius full), white `+`, bottom-right above nav, with a soft purple shadow.
6. Bottom nav (Home active).

> Section headers must hug their content height (auto) — a fixed small height causes the Archivo Black text to overflow up into the shelf above. Known gotcha.

---

## Bottom nav (all screens) — exact

5 slots, equal width (W/5 = 78.6 each), 84px tall, white bg, hairline on top edge.
Icons (stroke 1.6, 24px box): Home = house (roof peak + walls+base), Activity = pulse line, Log = plus, Search = magnifier (12px circle + short handle), Profile = head (8px circle) + shoulders arc.
Active item (Home): ink icon + ink SemiBold label + 24px ink rounded bar (radius 2) directly under the label. Inactive: navInactive (#B3B3B3) icon + label, no bar.

---

## How to consume this

Build `theme.ts` from the tokens block. Build shared components first — `Poster`, `StatRow`, `Tabs`, `ReviewRow`, `EpisodeRow`, `SeasonPills`, `BottomNav`, `FAB` — then compose the three screens. Wire to the Phase D data hooks. Posters in the real app come from TMDb image URLs; the recreated-poster placeholders are only for offline/mock states.
