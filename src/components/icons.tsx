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
      {/* Trending-up chart arrow (📈): a rising zig-zag line into a corner
          arrowhead at the top-right — the popularity glyph, not a plain up-arrow. */}
      <Path
        d="M3 17 L9 11 L13 15 L21 7"
        stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M15 7 L21 7 L21 13"
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

// Compose — a pencil on a rounded page, top-right corner left open so the pencil
// reads as "exiting" it (the iOS square.and.pencil shape). Used for "Review or log".
export function PencilSquareIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 4 H6.5 A2.5 2.5 0 0 0 4 6.5 V17.5 A2.5 2.5 0 0 0 6.5 20 H17.5 A2.5 2.5 0 0 0 20 17.5 V11"
        stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M18.7 3.3 L20.7 5.3 L11.5 14.5 L8.8 15.2 L9.5 12.5 Z"
        stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
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

// ----- Profile (Screen 5) ---------------------------------------------------

// iOS-style share: a tray with an arrow lifting out of it. Stroke 1.8 per spec.
export function ShareIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3 L12 14 M8.5 6.5 L12 3 L15.5 6.5"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M7 10 H5 V20 H19 V10 H17"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// Build an 8-tooth cog outline so it reads as a GEAR, not a sunburst. The
// difference is chunky trapezoidal teeth on a ring (+ a center hole), vs the
// thin radial rays that made the old version look like a brightness icon.
// Computed once at module load rather than hand-plotting 32 vertices.
function gearPath(): string {
  const cx = 12, cy = 12;
  const teeth = 8;
  const rTip = 10.5;   // tooth tip radius
  const rBase = 7.6;   // valley / ring radius
  const tipHalf = (9 * Math.PI) / 180;   // tooth tip half-angle (narrow)
  const baseHalf = (18 * Math.PI) / 180; // tooth base half-angle (wide → trapezoid)
  const step = (2 * Math.PI) / teeth;
  const pt = (ang: number, r: number) =>
    `${(cx + r * Math.cos(ang)).toFixed(2)} ${(cy + r * Math.sin(ang)).toFixed(2)}`;

  let d = '';
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    const corners = [
      pt(c - baseHalf, rBase), // rising edge bottom
      pt(c - tipHalf, rTip),   // tip left
      pt(c + tipHalf, rTip),   // tip right
      pt(c + baseHalf, rBase), // falling edge bottom
    ];
    d += `${i === 0 ? 'M' : 'L'} ${corners[0]} L ${corners[1]} L ${corners[2]} L ${corners[3]}`;
  }
  return `${d} Z`;
}
const GEAR_D = gearPath();

// Settings gear — cog outline (teeth) + center hole.
export function GearIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={GEAR_D} stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function ChevronRightIcon({ color = '#000', size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6 L15 12 L9 18"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// Up / down chevrons — the per-row reorder arrows in the list editor.
export function ChevronUpIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 15 L12 9 L18 15" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronDownIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9 L12 15 L18 9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// "Has a review" marker — short stacked lines (≡), Letterboxd-style. Also the
// Profile › Your record → Reviews row glyph (a list of written things).
export function ReviewBadgeIcon({ color = '#000', size = 12 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7 H20 M4 12 H20 M4 17 H14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Calendar — the Diary surface (date-grouped watch log) in Your record.
export function CalendarIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={5} width={17} height={16} rx={2} stroke={color} strokeWidth={1.6} />
      <Path
        d="M3.5 9.5 H20.5 M8 3.5 V6 M16 3.5 V6"
        stroke={color} strokeWidth={1.6} strokeLinecap="round"
      />
    </Svg>
  );
}

// Draft — a dashed page (an unfinished, unpublished review) for the Drafts row.
export function DraftIcon({ color = '#000', size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={16} height={16} rx={2} stroke={color} strokeWidth={1.6} strokeDasharray="3 3" />
    </Svg>
  );
}

// Clear (×) — for the search input's clear button.
export function CloseIcon({ color = '#000', size = 16 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6 L18 18 M18 6 L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
