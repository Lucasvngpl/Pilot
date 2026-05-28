// Pilot design tokens — exact values from PILOT_DESIGN_SPEC.md.
// Don't hardcode colors/sizes in components; reach for these.

export const colors = {
  ink:         '#1A1A18',
  white:       '#FFFFFF',
  muted:       '#737370',
  faint:       '#9E9E9C',
  navInactive: '#B3B3B3',
  hairline:    '#E5E5E3',
  purple:      '#6B45DB',
  gold:        '#F0A521',
  green:       '#298C54',
  red:         '#D9332A',
  cream:       '#F5F2E8',
  posterBlue:  '#2E5C9E',
  field:       '#F5F5F2',  // input bg, disabled-button bg, dashed-slot fill
  dashStroke:  '#CCCCC9',  // dashed empty-slot border + slot number
  scrim:       'rgba(26,26,24,0.45)', // dim backdrop behind bottom sheets
} as const;

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
} as const;
