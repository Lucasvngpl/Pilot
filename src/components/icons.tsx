// Custom SVG icons. Stroke 1.6, 24px box per the spec.
// Built by hand so we match the design exactly (vs pulling Feather/Ionicons,
// which have different proportions).

import Svg, { Path, Circle, Rect } from 'react-native-svg';

type Props = { color?: string; size?: number };

// ----- Bottom nav -----------------------------------------------------------

export function HomeIcon({ color = '#000', size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 11 L12 4 L21 11 V20 H3 Z"
        stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round"
      />
    </Svg>
  );
}

export function ActivityIcon({ color = '#000', size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12 H7 L9 6 L13 18 L15 12 H21"
        stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round"
      />
    </Svg>
  );
}

export function LogIcon({ color = '#000', size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5 V19 M5 12 H19" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function SearchIcon({ color = '#000', size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={10} cy={10} r={6} stroke={color} strokeWidth={1.6} />
      <Path d="M15 15 L20 20" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function ProfileIcon({ color = '#000', size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.6} />
      <Path
        d="M4 20 C4 16 8 14 12 14 C16 14 20 16 20 20"
        stroke={color} strokeWidth={1.6} strokeLinecap="round"
      />
    </Svg>
  );
}

// ----- Stats & ratings ------------------------------------------------------

// Rounded "warm" star — used for ratings.
export function StarIcon({ color = '#000', size = 16 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path
        d="M12 2.5 L14.7 8.5 L21 9.3 L16.3 13.7 L17.6 20 L12 16.8 L6.4 20 L7.7 13.7 L3 9.3 L9.3 8.5 Z"
        fill={color} strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TrendUpIcon({ color = '#000', size = 14 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 19 V5 M5 12 L12 5 L19 12"
        stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// ----- Watched checkmark (for episode rows) ---------------------------------

export function CheckIcon({ color = '#fff', size = 14 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12 L10 17 L19 7"
        stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// ----- Top-bar / nav-row glyphs --------------------------------------------

export function HamburgerIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7 H20 M4 12 H20 M4 17 H20"
        stroke={color} strokeWidth={1.6} strokeLinecap="round"
      />
    </Svg>
  );
}

export function ChevronLeftIcon({ color = '#000', size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 6 L9 12 L15 18"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DotsIcon({ color = '#000', size = 18 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={5}  cy={12} r={1.6} fill={color} />
      <Circle cx={12} cy={12} r={1.6} fill={color} />
      <Circle cx={19} cy={12} r={1.6} fill={color} />
    </Svg>
  );
}

// ----- Review-row meta icons ------------------------------------------------

export function HeartIcon({ color = '#000', size = 14 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20 C12 20 4 14 4 9 C4 6 6 4 9 4 C10.5 4 12 5 12 7 C12 5 13.5 4 15 4 C18 4 20 6 20 9 C20 14 12 20 12 20 Z"
        stroke={color} strokeWidth={1.6} strokeLinejoin="round" fill="none"
      />
    </Svg>
  );
}

export function CommentIcon({ color = '#000', size = 14 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5 H20 V15 H10 L5 19 V15 H4 Z"
        stroke={color} strokeWidth={1.6} strokeLinejoin="round" fill="none"
      />
    </Svg>
  );
}

// ----- ShowActionSheet glyphs ----------------------------------------------

// Solid play triangle for the Watching pill.
export function PlayIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5 L19 12 L8 19 Z" fill={color} />
    </Svg>
  );
}

// Clock face for the Watchlist pill.
export function ClockIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Path
        d="M12 7 V12 L15.5 14"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// Pencil-on-square for the "Review or log" action row.
export function PencilSquareIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 13 V20 H4 V5 H11"
        stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <Path
        d="M15 3 L21 9 L12 18 L6 18 L6 12 Z"
        stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </Svg>
  );
}

// 2x2 grid with a plus in the last cell for the "Add to lists" action row.
export function ListPlusIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={8} height={8} rx={1} stroke={color} strokeWidth={1.6} />
      <Rect x={13} y={3} width={8} height={8} rx={1} stroke={color} strokeWidth={1.6} />
      <Rect x={3} y={13} width={8} height={8} rx={1} stroke={color} strokeWidth={1.6} />
      <Path
        d="M17 14 V20 M14 17 H20"
        stroke={color} strokeWidth={1.6} strokeLinecap="round"
      />
    </Svg>
  );
}
