import {
  View, Text, StyleSheet, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useShow } from '@/api/useShow';
import { useRate } from '@/api/useRate';
import { usePostReview } from '@/api/usePostReview';
import { usePopularReviews } from '@/api/usePopularReviews';
import { useUpdateReview } from '@/api/useReviewMutations';
import { useRequireAuth } from '@/lib/requireAuth';
import { RatingPicker } from '@/components/RatingPicker';
import { SeasonPills } from '@/components/SeasonPills';
import { TextField } from '@/components/TextField';
import { ChevronLeftIcon, CheckIcon } from '@/components/icons';
import { colors, fonts, pad24, radius } from '@/theme';
import { formatScope } from '@/types';
import type { TmdbSeason } from '@/types';

type ScopeKind = 'show' | 'season' | 'episode';

// One screen, two modes:
//  - CREATE (default): pick scope → rate + write a new review.
//  - EDIT (?reviewId): pre-filled body/rating/spoiler; scope is LOCKED (shown as
//    a label, not editable — moving a review's scope = delete + re-create). Saves
//    body/spoiler via UPDATE and the rating via the same useRate as create.
export default function ReviewComposer() {
  const { id, reviewId } = useLocalSearchParams<{ id: string; reviewId?: string }>();
  const tmdbShowId = Number(id);
  const isEdit = !!reviewId;
  const { data } = useShow(tmdbShowId);
  const { data: reviewsData, isLoading: reviewsLoading } = usePopularReviews(tmdbShowId);
  const { rate } = useRate(tmdbShowId);
  const { postReview } = usePostReview(tmdbShowId);
  const { update: updateReview } = useUpdateReview(tmdbShowId);
  const requireAuth = useRequireAuth();

  const seasons = (data?.catalog.seasons ?? []) as TmdbSeason[];

  const [scopeKind, setScopeKind] = useState<ScopeKind>('show');
  const [season, setSeason] = useState<number>(seasons[0]?.season_number ?? 1);
  const [episode, setEpisode] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [spoilers, setSpoilers] = useState(false);
  const [posting, setPosting] = useState(false);

  // ----- Edit mode: find the review, pre-fill once, lock its scope -----------
  const existing = isEdit ? reviewsData?.reviews.find((r) => r.id === reviewId) ?? null : null;
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (isEdit && existing && !seeded) {
      setBody(existing.body);
      setSpoilers(existing.contains_spoilers);
      setScore(existing.rating); // may be null (reviewed without a rating)
      setSeeded(true);
    }
  }, [isEdit, existing, seeded]);

  const lockedScope = {
    season_number: existing?.season_number ?? null,
    episode_number: existing?.episode_number ?? null,
  };
  const scopeLabel = existing
    ? existing.season_number == null
      ? 'the whole show'
      : formatScope(existing.season_number, existing.episode_number)
    : '';

  // "Review or log": create can post with a body OR a rating (episode scope also
  // needs an episode). Edit requires a non-empty body — the row exists and has a
  // length>0 CHECK; to remove a review entirely, delete it from the ⋯ menu.
  const episodeReady = scopeKind !== 'episode' || episode !== null;
  const canPost = (body.trim().length > 0 || score !== null) && episodeReady && !posting;
  const canSaveEdit = body.trim().length > 0 && !posting;
  const canSubmit = isEdit ? canSaveEdit : canPost;

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

  const onSaveEdit = async () => {
    if (!canSaveEdit || !existing) return;
    setPosting(true);
    try {
      const allowed = await requireAuth();
      if (!allowed) return;
      // Rating uses the LOCKED scope (same row the review belongs to).
      let ok = true;
      if (score !== null) ok = await rate(score, lockedScope);
      if (ok) ok = await updateReview(reviewId!, body, spoilers);

      if (ok) {
        router.back();
      } else {
        Alert.alert(
          "Couldn't save your review",
          "Something went wrong. Your text is still here — check your connection and try again.",
        );
      }
    } finally {
      setPosting(false);
    }
  };

  // In edit mode, hold the form until the review is found (cache is usually warm
  // from the Reviews tab; cold deep-links fetch first).
  const editLoading = isEdit && !seeded && reviewsLoading;
  const editNotFound = isEdit && !seeded && !reviewsLoading && !existing;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={styles.navTitle}>{isEdit ? 'Edit review' : 'Write a review'}</Text>
        <Pressable onPress={isEdit ? onSaveEdit : onPost} hitSlop={8} disabled={!canSubmit}>
          <Text style={[styles.post, { color: canSubmit ? colors.purple : colors.faint }]}>
            {isEdit ? 'Save' : 'Post'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {data && <Text style={styles.showName}>{data.catalog.name}</Text>}

          {editLoading ? (
            <ActivityIndicator color={colors.ink} style={{ paddingVertical: 24 }} />
          ) : editNotFound ? (
            <Text style={styles.notFound}>Review not found.</Text>
          ) : (
            <>
              {isEdit ? (
                // Locked scope — show WHAT's being edited, read-only (not a
                // disabled-looking control).
                <Text style={styles.scopeLabel}>
                  Editing your review of <Text style={styles.scopeLabelStrong}>{scopeLabel}</Text>
                </Text>
              ) : (
                <>
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
                </>
              )}

              <RatingPicker value={score} onChange={setScore} />

              <TextField
                label={isEdit ? 'Review' : 'Review (optional)'}
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
            </>
          )}
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

  scopeLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginBottom: 16 },
  scopeLabelStrong: { fontFamily: fonts.semibold, color: colors.ink },
  notFound: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, paddingVertical: 24 },

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
