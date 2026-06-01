import Svg, { Rect, Line, Path, Circle } from 'react-native-svg';
import { useTheme } from '@/lib/theme';

// Placeholder for the eventual Procreate hand-drawn TV character.
// Simple line-art: rectangle TV body, screen inside, V-stand, antennae,
// purple power dot. Ink stroke 3 per spec.
export function TVIllustration({ size = 180 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 180 180" fill="none">
      {/* Antennae (drawn first so they sit behind the body) */}
      <Line x1={70} y1={50} x2={55} y2={25}
            stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />
      <Line x1={110} y1={50} x2={125} y2={25}
            stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />

      {/* Body */}
      <Rect x={30} y={50} width={120} height={80} rx={6}
            stroke={colors.ink} strokeWidth={3} fill="none" />

      {/* Inner screen */}
      <Rect x={42} y={62} width={96} height={56} rx={3}
            stroke={colors.ink} strokeWidth={2} fill="none" />

      {/* V-shaped stand */}
      <Path d="M70 130 L60 150 M110 130 L120 150"
            stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />

      {/* Power dot — the one purple accent */}
      <Circle cx={140} cy={120} r={3} fill={colors.purple} />
    </Svg>
  );
}
