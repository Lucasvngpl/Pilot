// Markdown — renders Pilot's stored rich-text subset (see src/lib/markdown.ts).
//
// Two modes, chosen by whether `numberOfLines` is passed:
//   - BLOCK mode (default): paragraphs + real "> " blockquotes (indented, with a
//     left rule). Used on full surfaces — review detail, list description, bio.
//   - CLAMPED mode (numberOfLines set): everything flattened into ONE <Text> so
//     RN can truncate across it (a blockquote rendered as its own <View> can't be
//     clamped by a parent's numberOfLines). Used for row/feed previews; the "> "
//     markers are dropped since indent isn't meaningful in a 2-line teaser.
//
// SECURITY: we only ever emit <Text> (and a link's onPress) for the four parsed
// constructs — there is no HTML path, so a stored string can't inject markup.
import { Fragment } from 'react';
import { View, Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import {
  parseBlocks,
  parseInline,
  stripBlockMarkers,
  type InlineSpan,
} from '@/lib/markdown';

type Props = {
  text: string;
  // Base text style (font/size/color). Bold/italic spans layer weight + style on
  // top of this, so callers pass the SAME style they'd give a plain <Text>.
  style?: StyleProp<TextStyle>;
  // Setting this switches to clamped/inline mode (truncated previews).
  numberOfLines?: number;
};

// Open a link in the in-app browser (keeps the user inside Pilot — important for
// the growth loop) for http(s); anything else is ignored rather than risking an
// unhandled scheme crash. URLs are normalized to https:// at insert time, so the
// stored hrefs are virtually always http(s).
async function openLink(href: string) {
  if (/^https?:\/\//i.test(href)) {
    try {
      await WebBrowser.openBrowserAsync(href);
    } catch {
      // Browser failed to open — nothing to recover.
    }
  }
}

// One inline span → a styled <Text>. Bold/italic switch fontFamily/fontStyle on
// top of the inherited base style (RN <Text> inherits parent style), links get
// the accent color + underline and a tap handler.
function renderSpan(span: InlineSpan, key: string, colors: Palette) {
  switch (span.type) {
    case 'bold':
      return <Text key={key} style={{ fontFamily: fonts.bold }}>{span.text}</Text>;
    case 'italic':
      // Inter ships no italic face, so RN synthesizes the slant — fine for body text.
      return <Text key={key} style={{ fontStyle: 'italic' }}>{span.text}</Text>;
    case 'bolditalic':
      return <Text key={key} style={{ fontFamily: fonts.bold, fontStyle: 'italic' }}>{span.text}</Text>;
    case 'link':
      return (
        <Text
          key={key}
          style={{ color: colors.purple, textDecorationLine: 'underline' }}
          onPress={() => openLink(span.href)}
        >
          {span.text}
        </Text>
      );
    default:
      return <Fragment key={key}>{span.text}</Fragment>;
  }
}

// Render a line's spans, inserting an explicit "\n" between lines so multi-line
// paragraphs/quotes keep the user's line breaks inside a single <Text>.
function renderLines(lines: string[], colors: Palette) {
  return lines.map((line, li) => (
    <Fragment key={li}>
      {li > 0 ? '\n' : null}
      {parseInline(line).map((span, si) => renderSpan(span, `${li}.${si}`, colors))}
    </Fragment>
  ));
}

export function Markdown({ text, style, numberOfLines }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  // CLAMPED: one <Text> over the whole (marker-stripped) string so numberOfLines
  // can truncate it as a unit.
  if (numberOfLines != null) {
    const flat = stripBlockMarkers(text).split('\n');
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {renderLines(flat, colors)}
      </Text>
    );
  }

  // BLOCK: paragraphs as plain <Text>, blockquotes wrapped in an indented View
  // with a left rule.
  const blocks = parseBlocks(text);
  return (
    <View>
      {blocks.map((block, bi) =>
        block.type === 'blockquote' ? (
          <View key={bi} style={styles.quote}>
            <Text style={style}>{renderLines(block.lines, colors)}</Text>
          </View>
        ) : (
          <Text key={bi} style={style}>{renderLines(block.lines, colors)}</Text>
        ),
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // Letterboxd-style quote: indented with a left rule. `hairline` keeps it
    // subtle in both themes.
    quote: {
      borderLeftWidth: 2,
      borderLeftColor: colors.hairline,
      paddingLeft: 12,
      marginVertical: 4,
    },
  });
