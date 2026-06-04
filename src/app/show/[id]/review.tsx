import {
  View, Text, StyleSheet, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useShow } from '@/api/useShow';
import { useRate } from '@/api/useRate';
import { usePostReview } from '@/api/usePostReview';
import { useReview } from '@/api/useReview';
import { useUpdateReview, useDeleteReview } from '@/api/useReviewMutations';
import { setWatched } from '@/api/setWatched';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import { RatingPicker } from '@/components/RatingPicker';
import { DatePickerRow } from '@/components/DatePickerRow';
import { SeasonPills } from '@/components/SeasonPills';
import { TextField } from '@/components/TextField';
import { Skeleton } from '@/components/Skeleton';
import { Button } from '@/components/Button';
import { ChevronLeftIcon, CheckIcon } from '@/components/icons';
import { fonts, pad24, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { formatScope, todayLocal } from '@/types';
import type { TmdbSeason } from '@/types';

type ScopeKind = 'show' | 'season' | 'episode';

// Write/edit a review, with DRAFTS.
//  - CREATE (default): pick scope → rate + write. Two actions: "Save draft"
//    (is_draft=true, never public) and "Publish" (is_draft=false, goes live).
//  - EDIT a DRAFT (?reviewId of a draft): pre-filled, scope LOCKED. "Save draft"
//    keeps it a draft; "Publish" flips it live.
//  - EDIT a PUBLISHED review: pre-filled, scope LOCKED. One "Save" — it stays
//    published (publishing is one-way in v1; no revert-to-draft).
// The rating writes publicly immediately (ratings have no draft state); only the
// review BODY is held back by a draft.
export default function ReviewComposer() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id, reviewId, season: seasonParam, episode: episodeParam } =
    useLocalSearchParams<{ id: string; reviewId?: string; season?: string; episode?: string }>();
  const tmdbShowId = Number(id);
  const isEdit = !!reviewId;

  // A PRESET scope (a new review opened from a specific scope's "Review" action,
  // e.g. ScopeActions on a season/episode) is preselected + LOCKED, the same way
  // an edit locks to its review's scope — you already chose what you're logging.
  // "0" is a valid season (specials), so test the string, not Number() truthiness.
  const presetSeason = !isEdit && seasonParam ? Number(seasonParam) : null;
  const presetEpisode = !isEdit && episodeParam ? Number(episodeParam) : null;
  const hasPreset = presetSeason != null;
  const { data } = useShow(tmdbShowId);
  // Edit loads the review directly by id (works for drafts, which get-reviews now hides).
  const { data: existingData, isLoading: reviewLoading } = useReview(reviewId);
  const { rate } = useRate(tmdbShowId);
  const { postReview } = usePostReview(tmdbShowId);
  const { update: updateReview } = useUpdateReview(tmdbShowId);
  const { remove: deleteReview } = useDeleteReview();
  const requireAuth = useRequireAuth();
  const { user } = useAuth();
  const qc = useQueryClient();

  const seasons = (data?.catalog.seasons ?? []) as TmdbSeason[];

  const [scopeKind, setScopeKind] = useState<ScopeKind>('show');
  const [season, setSeason] = useState<number>(seasons[0]?.season_number ?? 1);
  const [episode, setEpisode] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [spoilers, setSpoilers] = useState(false);
  // The chosen watch day ("YYYY-MM-DD"). Defaults to today, then auto-seeds from
  // the scope's existing watched row (below) — until the user edits it, at which
  // point `dateTouched` freezes the auto-seed so we don't clobber their pick.
  const [watchedOn, setWatchedOn] = useState<string>(todayLocal());
  const [dateTouched, setDateTouched] = useState(false);
  const [pending, setPending] = useState<'draft' | 'publish' | null>(null);
  const posting = pending !== null;

  // ----- Edit mode: pre-fill once, lock its scope ----------------------------
  const existing = existingData ?? null;
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (isEdit && existing && !seeded) {
      setBody(existing.body);
      setSpoilers(existing.contains_spoilers);
      setScore(existing.rating); // may be null (rated without text, or neither yet)
      setSeeded(true);
    }
  }, [isEdit, existing, seeded]);

  // Scope is locked when editing OR when a preset scope was passed in. The free
  // Show/Season/Episode selector only renders when neither holds.
  const scopeLocked = isEdit || hasPreset;
  const lockedScope = isEdit
    ? { season_number: existing?.season_number ?? null, episode_number: existing?.episode_number ?? null }
    : { season_number: presetSeason, episode_number: presetEpisode };
  const scopeLabel = isEdit
    ? existing
      ? existing.season_number == null
        ? 'the whole show'
        : formatScope(existing.season_number, existing.episode_number)
      : ''
    : hasPreset
      ? formatScope(presetSeason!, presetEpisode)
      : '';

  // The caller's existing 'watched' row for a scope (if any). Its watched_at
  // pre-fills the Date field — re-opening a log shows the date you saved, not
  // today. Explicit === null scope match (SQL NULL≠NULL would miss whole-show).
  const watchedRowFor = (s: number | null, e: number | null) =>
    data?.mySocial.watch_statuses.find(
      (r) => r.season_number === s && r.episode_number === e && r.status === 'watched',
    );

  // The scope the form is currently targeting, as primitives (stable effect deps).
  const activeSeason = scopeLocked
    ? lockedScope.season_number
    : scopeKind === 'show' ? null : season;
  const activeEpisode = scopeLocked
    ? lockedScope.episode_number
    : scopeKind === 'episode' ? episode : null;

  // Seed the Date field from the active scope's existing watch day (else today),
  // until the user edits it (dateTouched freezes the seed). Re-runs on scope change
  // and when the show data loads, so switching Show→Season picks up that scope's date.
  useEffect(() => {
    if (dateTouched) return;
    const row = watchedRowFor(activeSeason, activeEpisode);
    setWatchedOn(row?.watched_at ?? todayLocal());
    // watchedRowFor closes over `data`; the scope primitives drive the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, activeSeason, activeEpisode, dateTouched]);

  const isDraftEdit = isEdit && existing?.is_draft === true;
  // New review OR editing a draft → offer Save draft + Publish. Editing an
  // already-published review → a single Save (stays published).
  const showDraftActions = !isEdit || isDraftEdit;

  const episodeReady = scopeLocked ? true : scopeKind !== 'episode' || episode !== null;
  const hasContent = body.trim().length > 0 || score !== null; // review-or-log
  const canSaveDraft = hasContent && episodeReady && !posting;
  const canPublish = hasContent && episodeReady && !posting;
  const canSavePublished = body.trim().length > 0 && !posting; // published review needs text

  const episodesForSeason = seasons.find((s) => s.season_number === season)?.episodes ?? [];

  const resolveScope = () =>
    scopeKind === 'show'
      ? { season_number: null, episode_number: null }
      : scopeKind === 'season'
        ? { season_number: season, episode_number: null }
        : { season_number: season, episode_number: episode };

  // The "log" write: mark this scope WATCHED on the chosen day, plus the rating if
  // one was picked. When there's a rating, useRate owns the watched-write (passing
  // the date); a rating-less log (text-only) calls setWatched directly so it's still
  // dated. Returns false on dismissed login / failure so we don't navigate away.
  const logScope = async (scope: { season_number: number | null; episode_number: number | null }): Promise<boolean> => {
    if (score !== null) return rate(score, scope, watchedOn);
    if (!user) return false; // session dropped between the gate and here — fail loud
    try {
      await setWatched(user.id, tmdbShowId, scope, watchedOn);
      return true;
    } catch (e) {
      console.error('[review] setWatched failed:', e);
      return false;
    }
  };

  // After a successful save, refresh every surface the watched-write feeds. The
  // raw setWatched path has no onSettled of its own, and editing the date must
  // re-order the Diary + Watched grid — so invalidate them all here.
  const afterSaveInvalidate = () => {
    qc.invalidateQueries({ queryKey: ['diary'] });
    qc.invalidateQueries({ queryKey: ['watched'] });
    qc.invalidateQueries({ queryKey: ['watching'] });
    qc.invalidateQueries({ queryKey: ['watchlist'] });
    qc.refetchQueries({ queryKey: ['show', tmdbShowId] });
  };

  const onSaveDraft = async () => {
    if (!canSaveDraft) return;
    setPending('draft');
    try {
      if (!(await requireAuth())) return;
      const scope = scopeLocked ? lockedScope : resolveScope();
      let ok = await logScope(scope);
      if (ok) {
        ok = isEdit
          ? await updateReview(reviewId!, body, spoilers, true) // keep as draft
          : await postReview({ ...scope, body, contains_spoilers: spoilers, is_draft: true });
      }
      if (ok) { afterSaveInvalidate(); router.back(); }
      else Alert.alert("Couldn't save your draft", FAIL_MSG);
    } finally {
      setPending(null);
    }
  };

  const onPublish = async () => {
    if (!canPublish) return;
    setPending('publish');
    try {
      if (!(await requireAuth())) return;
      const scope = scopeLocked ? lockedScope : resolveScope();
      let ok = await logScope(scope);
      if (ok) {
        if (body.trim()) {
          ok = isEdit
            ? await updateReview(reviewId!, body, spoilers, false) // flip the draft live
            : await postReview({ ...scope, body, contains_spoilers: spoilers, is_draft: false });
        } else if (isDraftEdit) {
          // Publishing a rating-only draft: no text to publish and the rating is
          // already public, so just clear the empty draft row.
          try {
            await deleteReview(reviewId!, tmdbShowId);
          } catch {
            ok = false;
          }
        }
        // (new + rating-only: the rating IS the public "log"; no review row.)
      }
      if (ok) { afterSaveInvalidate(); router.back(); }
      else Alert.alert("Couldn't publish your review", FAIL_MSG);
    } finally {
      setPending(null);
    }
  };

  const onSavePublished = async () => {
    if (!canSavePublished) return;
    setPending('publish');
    try {
      if (!(await requireAuth())) return;
      let ok = await logScope(lockedScope);
      if (ok) ok = await updateReview(reviewId!, body, spoilers, false); // stays published
      if (ok) { afterSaveInvalidate(); router.back(); }
      else Alert.alert("Couldn't save your review", FAIL_MSG);
    } finally {
      setPending(null);
    }
  };

  // In edit mode, hold the form until the review loads (warm from the surface you
  // came from; cold deep-links fetch first).
  const editLoading = isEdit && !seeded && reviewLoading;
  const editNotFound = isEdit && !seeded && !reviewLoading && !existing;

  const navTitle = isEdit ? (existing?.is_draft ? 'Edit draft' : 'Edit review') : 'Write a review';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={styles.navTitle}>{navTitle}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {data && <Text style={styles.showName}>{data.catalog.name}</Text>}

          {editLoading ? (
            // Skeleton mirroring the edit form while the existing review loads.
            <View>
              <Skeleton width="55%" height={14} />
              <Skeleton width={160} height={30} style={{ marginTop: 22 }} />
              <Skeleton width={64} height={13} style={{ marginTop: 26 }} />
              <Skeleton height={110} radius={radius.md} style={{ marginTop: 8 }} />
              <View style={styles.editSkeletonSpoiler}>
                <Skeleton width={22} height={22} radius={radius.sm} />
                <Skeleton width={130} height={14} />
              </View>
            </View>
          ) : editNotFound ? (
            <Text style={styles.notFound}>Review not found.</Text>
          ) : (
            <>
              {/* "Watched on" — the date you watched this (Letterboxd's "I Watched…
                  → Date"). Defaults to today; pre-fills the saved day when editing.
                  Saving marks this scope watched on this day → Diary + Watched grid. */}
              <DatePickerRow
                value={watchedOn}
                onChange={(d) => { setWatchedOn(d); setDateTouched(true); }}
              />

              {scopeLocked ? (
                <Text style={styles.scopeLabel}>
                  {isEdit ? 'Editing your review of ' : 'Reviewing '}
                  <Text style={styles.scopeLabelStrong}>{scopeLabel}</Text>
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
                        <Text style={[styles.segText, { color: scopeKind === k ? colors.background : colors.ink }]}>
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
                          <Text style={[styles.epChipText, { color: episode === ep.episode_number ? colors.background : colors.ink }]}>
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
                label={showDraftActions ? 'Review (optional)' : 'Review'}
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

        {!editLoading && !editNotFound && (
          <View style={styles.footer}>
            {showDraftActions ? (
              <>
                <View style={styles.footerBtn}>
                  <Button label="Save draft" variant="secondary" onPress={onSaveDraft} disabled={!canSaveDraft} loading={pending === 'draft'} />
                </View>
                <View style={styles.footerBtn}>
                  <Button label="Publish" variant="primary" onPress={onPublish} disabled={!canPublish} loading={pending === 'publish'} />
                </View>
              </>
            ) : (
              <View style={styles.footerBtn}>
                <Button label="Save" variant="primary" onPress={onSavePublished} disabled={!canSavePublished} loading={posting} />
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const FAIL_MSG = "Something went wrong. Your text is still here — check your connection and try again.";

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad24,
    paddingVertical: 8,
  },
  navTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },

  body: { paddingHorizontal: pad24, paddingTop: 16, paddingBottom: 32 },
  showName: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginBottom: 16 },

  scopeLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginBottom: 16 },
  editSkeletonSpoiler: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26 },
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
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.hairline,
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

  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: pad24,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  footerBtn: { flex: 1 },
});
