// Design tokens for Pilot. Near-monochrome — ink on paper with one purple accent.
// Reference these via `colors.ink` etc., never hardcode hex in components.

export const colors = {
  ink:      '#1A1A18', // primary text + most UI
  paper:    '#FFFFFF', // backgrounds
  mute:     '#6B6B68', // secondary text
  hairline: '#E5E5E3', // dividers, low-emphasis borders
  accent:   '#6B45DC', // purple — used sparingly (CTAs, links)
  gold:     '#E6B800', // star ratings
  red:      '#DC4545', // popularity trend
} as const;

// Font family names match the keys we register in _layout.tsx via useFonts().
export const fonts = {
  display:      'ArchivoBlack_400Regular',
  body:         'Inter_400Regular',
  bodyMedium:   'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold:     'Inter_700Bold',
} as const;

// 4pt grid — pick the nearest token instead of using arbitrary numbers.
export const space = {
  xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
} as const;

export const radius = {
  sm: 4, md: 8, lg: 12,
} as const;
