// markdown.ts — the pure (no React Native) core of Pilot's rich-text subset.
//
// We store a SMALL markdown subset, not HTML or a JSON doc, so that:
//   - plain text is already valid markdown → existing reviews/bios render with
//     zero migration, and
//   - the format is human-legible in the DB and trivially safe (we only ever
//     render the four constructs below — never arbitrary HTML).
//
// Supported subset:
//   **bold**            *italic*            ***bold italic***
//   [title](url)        > blockquote (one leading "> " per line = "indent")
//
// This file is split in two halves:
//   1. PARSE   — turn a stored string into blocks/spans the renderer can map.
//   2. TRANSFORM — the toolbar's edits (wrap/unwrap, blockquote toggle, link
//      insert) expressed as pure `(text, selection) -> { text, selection }`.
// Keeping them pure means they're fast and unit-testable with no RN in the loop.

// ----- Shared types ---------------------------------------------------------

// A text selection in a TextInput: character offsets. `start === end` is a caret.
export type Selection = { start: number; end: number };

// Result of a toolbar transform: the new full text + where the selection should
// land afterwards (so the caret/highlight follows the edit instead of jumping).
export type Edit = { text: string; selection: Selection };

// ----- 1. PARSE (for the renderer) ------------------------------------------

// One inline run within a line. The renderer maps each to a styled <Text>.
export type InlineSpan =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'bolditalic'; text: string }
  | { type: 'link'; text: string; href: string };

// A block is a run of lines sharing a layout: a normal paragraph, or a "> "
// blockquote (the markers stripped). Blank lines stay as empty paragraph lines
// so vertical spacing the user typed is preserved.
export type Block =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'blockquote'; lines: string[] };

// Inline tokenizer. Tried left-to-right per position, so the *** / ** / * order
// matters (longest run first). `.+?` is non-greedy so adjacent spans don't merge
// (`**a** **b**` → two bolds). `.` excludes newlines, so a marker never spans a
// line break — we parse per line anyway. Links: title = anything but `]`, url =
// non-`)`/non-space.
const INLINE_RE =
  /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(line: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  // exec() with a /g regex advances lastIndex; reset so the fn is reentrant.
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(line)) !== null) {
    if (m.index > last) spans.push({ type: 'text', text: line.slice(last, m.index) });
    if (m[1] !== undefined) spans.push({ type: 'bolditalic', text: m[1] });
    else if (m[2] !== undefined) spans.push({ type: 'bold', text: m[2] });
    else if (m[3] !== undefined) spans.push({ type: 'italic', text: m[3] });
    else if (m[4] !== undefined) spans.push({ type: 'link', text: m[4], href: m[5] });
    last = m.index + m[0].length;
  }
  if (last < line.length) spans.push({ type: 'text', text: line.slice(last) });
  // A line with no markers still yields one text span (or none if empty).
  return spans;
}

export function parseBlocks(text: string): Block[] {
  const out: Block[] = [];
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('> ')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quote.push(lines[i].slice(2));
        i++;
      }
      out.push({ type: 'blockquote', lines: quote });
    } else {
      const para: string[] = [];
      while (i < lines.length && !lines[i].startsWith('> ')) {
        para.push(lines[i]);
        i++;
      }
      out.push({ type: 'paragraph', lines: para });
    }
  }
  return out;
}

// For the clamped row/snippet preview: drop the "> " markers so a blockquote
// reads as plain (indent isn't meaningful in a 2-line teaser), keeping inline
// bold/italic/link. Returns text safe to feed straight into parseInline per line.
export function stripBlockMarkers(text: string): string {
  return text
    .split('\n')
    .map((l) => (l.startsWith('> ') ? l.slice(2) : l))
    .join('\n');
}

// ----- 2. TRANSFORM (for the toolbar) ---------------------------------------

// Normalize a possibly-reversed selection to ascending offsets (a drag-select
// can report start > end).
function ordered(sel: Selection): Selection {
  return { start: Math.min(sel.start, sel.end), end: Math.max(sel.start, sel.end) };
}

// Does `s` END with exactly `marker` and not a LONGER run of '*'? Used so the
// italic toggle ('*') doesn't see the inner '*' of a surrounding '**' (bold) and
// half-unwrap it into garbage. e.g. for "**" + marker "*", the char before the
// trailing '*' is also '*', so this returns false.
function endsWithExact(s: string, marker: string): boolean {
  if (!s.endsWith(marker)) return false;
  const before = s[s.length - marker.length - 1];
  return before !== '*';
}
function startsWithExact(s: string, marker: string): boolean {
  if (!s.startsWith(marker)) return false;
  const after = s[marker.length];
  return after !== '*';
}

// Bold/Italic. Three cases, in order:
//   A. markers sit just OUTSIDE the selection  → unwrap (remove them).
//   B. the selection itself is wrapped          → unwrap (strip inner markers).
//   C. neither                                  → wrap the selection.
// With an empty selection, C drops the caret between the two markers so the user
// can type formatted text immediately (matches every editor's "B then type").
export function toggleWrap(text: string, selection: Selection, marker: string): Edit {
  const { start, end } = ordered(selection);
  const m = marker.length;
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  // Case A — wrapped from outside.
  if (endsWithExact(before, marker) && startsWithExact(after, marker)) {
    return {
      text: before.slice(0, -m) + selected + after.slice(m),
      selection: { start: start - m, end: end - m },
    };
  }
  // Case B — selection includes its own markers.
  if (
    selected.length >= 2 * m &&
    startsWithExact(selected, marker) &&
    endsWithExact(selected, marker)
  ) {
    const inner = selected.slice(m, selected.length - m);
    return { text: before + inner + after, selection: { start, end: start + inner.length } };
  }
  // Case C — wrap.
  return {
    text: before + marker + selected + marker + after,
    selection: { start: start + m, end: end + m },
  };
}

// Indent = toggle a leading "> " on every line the selection touches. The first
// line's state decides the whole block (all-on → remove, else add), so it never
// half-toggles a mixed block into a worse mixed state.
export function toggleBlockquote(text: string, selection: Selection): Edit {
  const { start, end } = ordered(selection);
  // Expand the range to whole lines: back to the char after the previous '\n'…
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  // …and forward to the next '\n' (or end of text).
  let lineEnd = text.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = text.length;

  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const removing = lines[0].startsWith('> ');
  const newLines = lines.map((l) =>
    removing ? (l.startsWith('> ') ? l.slice(2) : l) : `> ${l}`,
  );
  const newBlock = newLines.join('\n');
  const newText = text.slice(0, lineStart) + newBlock + text.slice(lineEnd);

  // Shift the caret/selection: the first line gained or lost 2 chars (so does
  // `start`); `end` shifts by the total length delta across all touched lines.
  const firstDelta = removing ? -2 : 2;
  const totalDelta = newBlock.length - block.length;
  return {
    text: newText,
    selection: {
      start: Math.max(lineStart, start + firstDelta),
      end: end + totalDelta,
    },
  };
}

// Insert (or replace the selection with) a markdown link. Caret lands AFTER the
// inserted link so typing continues normally.
export function insertLink(
  text: string,
  selection: Selection,
  title: string,
  url: string,
): Edit {
  const { start, end } = ordered(selection);
  const md = `[${title}](${url})`;
  const caret = start + md.length;
  return { text: text.slice(0, start) + md + text.slice(end), selection: { start: caret, end: caret } };
}

// Lenient URL fix-up for the link modal: add https:// when the user typed a bare
// host ("pilot.app"). Leaves an existing scheme (http, https, mailto, …) alone.
export function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  // <scheme>:// … or mailto: — already qualified.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^mailto:/i.test(t)) return t;
  return `https://${t}`;
}
