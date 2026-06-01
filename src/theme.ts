// Pilot design tokens — exact values from PILOT_DESIGN_SPEC.md.
// Don't hardcode colors/sizes in components; reach for these.
//
// Dark mode: every color token has a LIGHT and a DARK value under the SAME name.
// Components never read these two objects directly — they get the active palette
// from `useThemedStyles(makeStyles)` / `useTheme()` (src/lib/theme.tsx), so colors
// resolve at *render* time and a mode switch re-renders with the new values.
// (A plain `import { colors }` baked into StyleSheet.create can't live-switch —
// StyleSheet copies the value once at module load.)
//
// Token roles after the dark-mode work:
//   - `ink`  = primary text / icons / active-control fills. FLIPS dark→light, which
//              also makes selected pills/chips invert to a light fill for free.
//   - `white` = foreground on a *saturated* fill (e.g. label on the purple button).
//              FIXED #FFFFFF in both modes — do NOT use it for backgrounds.
//   - `background`/`surface`/`surface2` = screen / card / secondary backgrounds.
//   - `bannerInk` = the always-dark hero banners (list + review). FIXED dark.

export const lightColors = {
  background:  '#FFFFFF',  // full-screen backgrounds
  surface:     '#FFFFFF',  // cards / rows / sheets (sits above `background`)
  surface2:    '#F5F5F2',  // secondary surface panels
  ink:         '#1A1A18',  // primary text / icons / active-control fills
  white:       '#FFFFFF',  // FIXED — foreground on a saturated fill
  bannerInk:   '#1A1A18',  // FIXED — always-dark hero banners
  muted:       '#737370',  // secondary text
  faint:       '#9E9E9C',  // tertiary / dim text
  navInactive: '#B3B3B3',  // inactive bottom-nav icon
  hairline:    '#E5E5E3',  // dividers / hairlines
  purple:      '#6B45DB',  // accent
  gold:        '#F0A521',  // FIXED — stars
  green:       '#298C54',  // FIXED — FRESH tag
  red:         '#D9332A',  // FIXED — popularity
  cream:       '#F5F2E8',  // welcome bg / poster placeholder
  posterBlue:  '#2E5C9E',  // poster placeholder accent (unused)
  field:       '#F5F5F2',  // input bg, disabled-button bg, idle chip/pill fill
  dashStroke:  '#CCCCC9',  // dashed empty-slot border + slot number
  scrim:       'rgba(26,26,24,0.45)', // dim backdrop behind bottom sheets
} as const;

// Same keys, dark values. `gold`/`green`/`red`/`white`/`bannerInk`/`posterBlue`
// are FIXED (read fine on dark or are role-locked) — everything else flips.
export const darkColors: Palette = {
  background:  '#121212',
  surface:     '#1A1A18',
  surface2:    '#201F1D',
  ink:         '#F0F0ED',  // was the dark ink → now the light text in dark mode
  white:       '#FFFFFF',  // FIXED
  bannerInk:   '#1A1A18',  // FIXED
  muted:       '#8A8A85',
  faint:       '#6E6E68',
  navInactive: '#5A5A56',
  hairline:    '#242422',
  purple:      '#9B7FF0',  // light-mode purple lightened for dark contrast
  gold:        '#F0A521',  // FIXED
  green:       '#298C54',  // FIXED
  red:         '#D9332A',  // FIXED
  cream:       '#201F1D',
  posterBlue:  '#2E5C9E',  // FIXED (unused)
  field:       '#1F1E1C',
  dashStroke:  '#3A3A37',
  scrim:       'rgba(0,0,0,0.6)',
};

// The shape every palette satisfies. `-readonly` so a `makeStyles(colors)` factory
// can treat it as a plain string map. `lightColors` defines the canonical key set.
export type Palette = { -readonly [K in keyof typeof lightColors]: string };

// Back-compat default export = the light palette. Keeps any file still doing
// `import { colors }` compiling; live theming comes from the hooks, not this.
export const colors = lightColors;

// Font family names match the keys registered via useFonts() in _layout.tsx.
// Pick the weight matching the spec — Inter Regular/Medium/SemiBold/Bold.
export const fonts = {
  display:  'ArchivoBlack_400Regular',
  regular:  'Inter_400Regular',
  medium:   'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold:     'Inter_700Bold',
} as const;

export const radius = { sm: 4, md: 6, pill: 20, full: 999 } as const;
export const pad = 20;   // editorial side margin on most screens
export const pad24 = 24; // larger margin on Auth / Login (per spec)

// Type styles — exact font/size pairs from the spec. Spread these into Text
// `style` props (with the color applied alongside) to avoid restating fontFamily
// + fontSize in every component.
export const type = {
  wordmark:     { fontFamily: fonts.display,  fontSize: 19 },
  screenTitle:  { fontFamily: fonts.display,  fontSize: 40 },
  sectionH:     { fontFamily: fonts.display,  fontSize: 22 },
  compactH:     { fontFamily: fonts.display,  fontSize: 26 },
  statusBar:    { fontFamily: fonts.semibold, fontSize: 15 },
  kicker:       { fontFamily: fonts.semibold, fontSize: 11 },
  freshTag:     { fontFamily: fonts.bold,     fontSize: 11 },
  creator:      { fontFamily: fonts.regular,  fontSize: 17 },
  statValue:    { fontFamily: fonts.bold,     fontSize: 17 },
  statLabel:    { fontFamily: fonts.semibold, fontSize: 10 },
  tabActive:    { fontFamily: fonts.bold,     fontSize: 15 },
  tabInactive:  { fontFamily: fonts.medium,   fontSize: 15 },
  chipText:     { fontFamily: fonts.bold,     fontSize: 10 },
  subhead:      { fontFamily: fonts.bold,     fontSize: 16 },
  filter:       { fontFamily: fonts.medium,   fontSize: 13 },
  reviewUser:   { fontFamily: fonts.semibold, fontSize: 13 },
  reviewTitle:  { fontFamily: fonts.bold,     fontSize: 15 },
  reviewSeason: { fontFamily: fonts.regular,  fontSize: 13 },
  reviewBody:   { fontFamily: fonts.regular,  fontSize: 14 },
  reviewMeta:   { fontFamily: fonts.medium,   fontSize: 12 },
  pillActive:   { fontFamily: fonts.semibold, fontSize: 13 },
  pillInactive: { fontFamily: fonts.medium,   fontSize: 13 },
  markAll:      { fontFamily: fonts.semibold, fontSize: 13 },
  epRuntime:    { fontFamily: fonts.regular,  fontSize: 12 },
  epRating:     { fontFamily: fonts.medium,   fontSize: 12 },
  epNum:        { fontFamily: fonts.bold,     fontSize: 15 },
  friendName:   { fontFamily: fonts.semibold, fontSize: 12 },
  navActive:    { fontFamily: fonts.semibold, fontSize: 11 },
  navMuted:     { fontFamily: fonts.medium,   fontSize: 11 },
  // Profile (Screen 5)
  profileSection: { fontFamily: fonts.display,  fontSize: 20 }, // "Your Top 4" / "Currently watching"
  countValue:     { fontFamily: fonts.bold,     fontSize: 14 }, // follower / following numbers
  countLabel:     { fontFamily: fonts.regular,  fontSize: 14 }, // "Following" / "Followers"
} as const;
