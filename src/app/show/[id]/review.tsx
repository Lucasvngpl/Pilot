import {
  View, Text, StyleSheet, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useShow } from '@/api/useShow';
import { useRate } from '@/api/useRate';
import { usePostReview } from '@/api/usePostReview';
import { useRequireAuth } from '@/lib/requireAuth';
import { RatingPicker } from '@/components/RatingPicker';
import { SeasonPills } from '@/components/SeasonPills';
import { TextField } from '@/components/TextField';
import { ChevronLeftIcon, CheckIcon } from '@/components/icons';
import { colors, fonts, pad24, radius } from '@/theme';
import type { TmdbSeason } from '@/types';

type ScopeKind = 'show' | 'season' | 'episode';

export default function ReviewComposer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data } = useShow(tmdbShowId);
  const { rate } = useRate(tmdbShowId);
  const { postReview } = usePostReview(tmdbShowId);
  const requireAuth = useRequireAuth();

  const seasons = (data?.catalog.seasons ?? []) as TmdbSeason[];

  const [scopeKind, setScopeKind] = useState<ScopeKind>('show');
  const [season, setSeason] = useState<number>(seasons[0]?.season_number ?? 1);
  const [episode, setEpisode] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [spoilers, setSpoilers] = useState(false);
  const [posting, setPosting] = useState(false);

  // "Review or log": enabled if there's a body OR a rating. Episode scope also
  // needs an episode picked.
  const episodeReady = scopeKind !== 'episode' || episode !== null;
  const canPost = (body.trim().length > 0 || score !== null) && episodeReady && !posting;

  const episodesForSeason =
    seasons.find((s) => s.season_number === season)?.episodes ?? [];

  const resolveScope = () => {
    if (scopeKind === 'show') return { season_number: null, episode_number: null };
    if (scopeKind === 'season') return { season_number: season, episode_number: null };
    return { season_number: season, episode_number: episode };
  };

  const onPost = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      // Gate once up front so we don't risk two LoginSheets from the two writes.
      const allowed = await requireAuth();
      if (!allowed) return;
      const scope = resolveScope();

      // Only leave the screen if every write we attempted actually persisted.
      // rate()/postReview() return false on failure instead of throwing, so the
      // old code's unconditional router.back() silently discarded a failed
      // review (dropped network = your text vanished, no error). Now we keep the
      // user here with their text intact and surface the failure.
      let ok = true;
      if (score !== null) ok = await rate(score, scope);
      if (ok && body.trim()) {
        ok = await postReview({ ...scope, body, contains_spoilers: spoilers });
      }

      if (ok) {
        router.back();
      } else {
        Alert.alert(
          "Couldn't post your review",
          "Something went wrong saving it. Your text is still here — check your connection and try again.",
        );
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={styles.navTitle}>Write a review</Text>
        <Pressable onPress={onPost} hitSlop={8} disabled={!canPost}>
          <Text style={[styles.post, { color: canPost ? colors.purple : colors.faint }]}>Post</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {data && <Text style={styles.showName}>{data.catalog.name}</Text>}

          {/* Scope: Show / Season / Episode */}
          <View style={styles.segment}>
            {(['show', 'season', 'episode'] as ScopeKind[]).map((k) => (
              <Pressable
                key={k}
                onPress={() => {
                  setScopeKind(k);
                  if (k === 'episode' && episode === null) {
                    setEpisode(episodesForSeason[0]?.episode_number ?? 1);
                  }
                }}
                style={[styles.segItem, scopeKind === k && styles.segItemActive]}
              >
                <Text style={[styles.segText, { color: scopeKind === k ? colors.white : colors.ink }]}>
                  {k === 'show' ? 'Show' : k === 'season' ? 'Season' : 'Episode'}
                </Text>
              </Pressable>
            ))}
          </View>

          {scopeKind !== 'show' && (
            <SeasonPills
              seasons={seasons.map((s) => s.season_number)}
              active={season}
              onChange={(n) => { setSeason(n); setEpisode(null); }}
            />
          )}

          {scopeKind === 'episode' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.epRow}>
              {episodesForSeason.map((ep) => (
                <Pressable
                  key={ep.episode_number}
                  onPress={() => setEpisode(ep.episode_number)}
                  style={[styles.epChip, episode === ep.episode_number && styles.epChipActive]}
                >
                  <Text style={[styles.epChipText, { color: episode === ep.episode_number ? colors.white : colors.ink }]}>
                    E{ep.episode_number}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <RatingPicker value={score} onChange={setScore} />

          <TextField
            label="Review (optional)"
            value={body}
            onChangeText={setBody}
            placeholder="What did you think?"
            multiline
          />

          <Pressable style={styles.spoilerRow} onPress={() => setSpoilers((s) => !s)}>
            <View style={[styles.checkbox, spoilers && styles.checkboxOn]}>
              {spoilers && <CheckIcon color={colors.white} size={12} />}
            </View>
            <Text style={styles.spoilerLabel}>Contains spoilers</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad24,
    paddingVertical: 8,
  },
  navTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  post: { fontFamily: fonts.semibold, fontSize: 16 },

  body: { paddingHorizontal: pad24, paddingTop: 16, paddingBottom: 32 },
  showName: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginBottom: 16 },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.field,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: 8,
  },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm },
  segItemActive: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.semibold, fontSize: 13 },

  epRow: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  epChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.hairline,
  },
  epChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  epChipText: { fontFamily: fonts.medium, fontSize: 13 },

  spoilerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: radius.sm,
    borderWidth: 1.5, borderColor: colors.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.purple, borderColor: colors.purple },
  spoilerLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
});
