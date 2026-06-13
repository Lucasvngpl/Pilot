// /show/[id] — Show Detail LANDING = the Overview tab: hero (poster, metadata,
// community stats, your rating card) + summary + principal cast. Reviews/Seasons/
// Lists are sibling tab routes. Summary + cast come from the cached TMDb payload
// (cast via append_to_response=credits). Tapping a cast member → /person/[id].
import { ScrollView, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useShow } from '@/api/useShow';
import { usePopularReviews } from '@/api/usePopularReviews';
import { useShowLists } from '@/api/useShowLists';
import { useProfile } from '@/api/useProfile';
import { useAuth } from '@/lib/auth';
import { Poster } from '@/components/Poster';
import { StatRow } from '@/components/StatRow';
import { Tabs } from '@/components/Tabs';
import { ShowNavRow } from '@/components/ShowNavRow';
import { ShowActionSheet } from '@/components/ShowActionSheet';
import { UserRatingCard } from '@/components/UserRatingCard';
import { ShowDetailSkeleton } from '@/components/ShowDetailSkeleton';
import { type, pad, fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { tmdbImage, type TmdbCastMember, type TmdbPayload, type WatchProvider } from '@/types';

const CAST_COLS = 3;  // cast grid columns
const CAST_GAP = 12;  // gap between cells (row + column)

export default function ShowDetail() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading, error } = useShow(tmdbShowId);
  // The other tabs' count badges (cached, shared across the tab screens).
  const { data: reviewsData } = usePopularReviews(tmdbShowId);
  const { data: showLists } = useShowLists(tmdbShowId);
  const { user } = useAuth();
  const { data: myProfile } = useProfile(user?.id); // cached from the Profile screen
  const myAvatar = myProfile?.profile?.avatar_url ?? null;
  const [sheetOpen, setSheetOpen] = useState(false);

  // Cast cell width: split the content width into CAST_COLS columns minus the gaps.
  const { width: screenW } = useWindowDimensions();
  const cellW = Math.floor((screenW - pad * 2 - CAST_GAP * (CAST_COLS - 1)) / CAST_COLS);

  // Show-scope status + rating (both nullable) — drive nav-row state, card, sheet.
  const showScopeStatus = data?.mySocial.watch_statuses.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.status ?? null;
  const showScopeRating = data?.mySocial.ratings.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.score ?? null;

  // --- Catalog meta (all from the cached /tv payload — no backend call) ---
  const c = data?.catalog;
  // year · seasons · content rating (TV-MA / TV-14). The rating replaces the old
  // lifecycle status ("Ended") — that's now conveyed by the air-date line below.
  const metaParts = [
    c?.first_air_date?.slice(0, 4),
    c?.number_of_seasons ?? c?.seasons?.length
      ? `${c?.number_of_seasons ?? c?.seasons?.length} Season${(c?.number_of_seasons ?? c?.seasons?.length) === 1 ? '' : 's'}`
      : null,
    usRating(c),
  ].filter(Boolean) as string[];
  const nextAir = formatAirDate(c?.next_episode_to_air?.air_date);
  const lastAir = formatAirDate(c?.last_episode_to_air?.air_date);
  const providers = usProviders(c).slice(0, 4); // "where to watch" — US streaming
  // Info block (moved off the hero into the Overview body): status + aired range.
  // Range end is "present" for ongoing shows (has a next episode), else last aired.
  const status = prettyStatus(c?.status);
  const firstYear = c?.first_air_date?.slice(0, 4) ?? null;
  const airedEnd = nextAir ? 'present' : lastAir;
  const airedRange = firstYear ? (airedEnd ? `${firstYear} – ${airedEnd}` : firstYear) : null;
  const awards = c?.omdb?.awards ?? null; // OMDb freeform string (TMDb has no awards)

  const overview = data?.catalog.overview?.trim();
  const cast = data?.catalog.credits?.cast ?? []; // show all, in a grid

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ShowNavRow status={showScopeStatus} onCheckPress={() => setSheetOpen(true)} />

      {/* flex:1 so the skeleton FILLS the column and BottomNav stays pinned to the
          bottom during the load. The skeleton is shorter than the screen, so without
          this the nav sits at content height — visibly risen off the bottom edge for
          that split second before `data` arrives (the loaded ScrollView fills it). */}
      {isLoading && (
        <View style={{ flex: 1 }}>
          <ShowDetailSkeleton />
        </View>
      )}
      {error && <Text style={[styles.muted, styles.center]}>Couldn&apos;t load show.</Text>}

      {data && (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.heroWrap}>
            <Poster
              tmdbShowId={tmdbShowId}
              posterPath={data.catalog.poster_path}
              name={data.catalog.name}
              // 168 (up from 152): a slightly taller hero pushes the Summary heading
              // below the fold so the resting view ends on a clean gap after Awards,
              // not on a half-clipped "Summary".
              width={168}
              pressable={false}
            />
          </View>

          <View style={styles.kickerRow}>
            {data.catalog.genres?.[0] && (
              <Text style={[type.kicker, { color: colors.faint, letterSpacing: 0.5 }]}>
                {data.catalog.genres[0].name.toUpperCase()} ·{' '}
              </Text>
            )}
            <Text style={[type.freshTag, { color: colors.green, letterSpacing: 0.5 }]}>FRESH</Text>
          </View>

          <Text
            style={[
              type.screenTitle,
              // Nudged down from the 40px screenTitle token + a tight line height: the
              // line height is what really shrinks a two-line title (e.g. STRANGER
              // THINGS), keeping the Overview info block (incl. Awards' 2nd line) on
              // screen. Inline so the shared token keeps its spec value.
              { color: colors.ink, fontSize: 34, lineHeight: 36, textAlign: 'center', marginTop: 6, paddingHorizontal: pad },
            ]}
          >
            {data.catalog.name.toUpperCase()}
          </Text>

          {data.catalog.created_by?.[0] && (
            <Text style={[type.creator, { color: colors.muted, textAlign: 'center', marginTop: 6 }]}>
              {data.catalog.created_by[0].name}
            </Text>
          )}

          {/* Meta line: year · seasons · status. Centered to match the hero. */}
          {metaParts.length > 0 && (
            <Text style={[styles.meta, { color: colors.muted }]}>
              {metaParts.join('  ·  ')}
            </Text>
          )}

          {/* Tagline — the show's one-liner. Synthetic italic is fine for one line. */}
          {data.catalog.tagline ? (
            <Text style={[styles.tagline, { color: colors.faint }]}>
              &ldquo;{data.catalog.tagline}&rdquo;
            </Text>
          ) : null}

          <View style={styles.statWrap}>
            <StatRow
              rating={data.stats?.avgRating ?? null}
              viewers={data.stats?.viewers ?? 0}
              viewerAvatars={[
                // You don't follow yourself, so prepend your face when you're a viewer.
                ...(data.mySocial.watch_statuses.length > 0 && myAvatar ? [myAvatar] : []),
                ...(data.stats?.viewerAvatars ?? []).map((v) => v.avatar_url),
              ]}
              onViewersPress={() => router.push(`/show/${tmdbShowId}/viewers` as any)}
              popularity={Math.round((data.catalog as { popularity?: number }).popularity ?? 0)}
            />
          </View>

          <UserRatingCard rating={showScopeRating ?? 0} avatarUrl={myAvatar} onPress={() => setSheetOpen(true)} />

          <Tabs
            showId={tmdbShowId}
            active="overview"
            counts={{
              reviews: reviewsData?.reviews.length,
              seasons: data.catalog.seasons?.length,
              lists: showLists?.length,
            }}
          />

          {/* Show info — moved off the (too-tall) hero into the Overview body:
              status · aired range · where to watch. A labeled mini-table. */}
          <View style={styles.infoBlock}>
            {status && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={styles.infoValue}>{status}</Text>
              </View>
            )}
            {airedRange && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Aired</Text>
                <Text style={styles.infoValue}>{airedRange}</Text>
              </View>
            )}
            {providers.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Available on</Text>
                <View style={styles.infoLogos}>
                  {providers.map((p) => {
                    const logo = tmdbImage(p.logo_path, 'w92');
                    return logo ? (
                      <Image
                        key={p.provider_id}
                        source={{ uri: logo }}
                        style={styles.infoLogo}
                        contentFit="cover"
                      />
                    ) : null;
                  })}
                </View>
              </View>
            )}
            {awards && (
              // Awards wraps to a few lines, so top-align the label with line 1.
              <View style={[styles.infoRow, styles.infoRowTop]}>
                <Text style={styles.infoLabel}>Awards</Text>
                <Text style={styles.infoAwards}>{awards}</Text>
              </View>
            )}
          </View>

          {/* Summary — from the cached payload; honest fallback when TMDb has none. */}
          <Text style={[type.subhead, styles.sectionTitle, { color: colors.ink }]}>Summary</Text>
          <Text style={[styles.summary, { color: overview ? colors.ink : colors.muted }]}>
            {overview || 'No summary available.'}
          </Text>

          {/* Cast — the full billed cast as a wrapping grid; each tile → the actor's page. */}
          <Text style={[type.subhead, styles.sectionTitle, { color: colors.ink }]}>Cast</Text>
          {cast.length === 0 ? (
            <Text style={[styles.muted, { paddingHorizontal: pad, paddingBottom: 8 }]}>
              No cast available.
            </Text>
          ) : (
            <View style={styles.castGrid}>
              {cast.map((member) => (
                <CastCard key={member.id} member={member} width={cellW} />
              ))}
            </View>
          )}
        </ScrollView>
      )}


      <ShowActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        tmdbShowId={tmdbShowId}
        currentStatus={showScopeStatus}
        currentRating={showScopeRating}
      />
    </SafeAreaView>
  );
}

// One cast member: headshot (placeholder when TMDb has none) + actor + character.
// `width` is the grid cell width; the photo keeps a 2:3 poster-ish ratio. Tap →
// the actor's page (/person/[id]) with their bio + TV appearances.
function CastCard({ member, width }: { member: TmdbCastMember; width: number }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const photo = tmdbImage(member.profile_path, 'w185');
  const photoStyle = { width, height: Math.round(width * 1.5), borderRadius: radius.md };
  return (
    <Pressable style={{ width }} onPress={() => router.push(`/person/${member.id}` as any)}>
      {photo ? (
        <Image source={{ uri: photo }} style={[styles.castPhoto, photoStyle]} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.castPhoto, styles.castPhotoEmpty, photoStyle]}>
          <Text style={[type.statLabel, { color: colors.faint }]}>No photo</Text>
        </View>
      )}
      <Text style={[type.reviewUser, { color: colors.ink, marginTop: 6 }]} numberOfLines={1}>
        {member.name}
      </Text>
      {member.character ? (
        <Text style={[type.epRuntime, { color: colors.muted, marginTop: 1 }]} numberOfLines={1}>
          {member.character}
        </Text>
      ) : null}
    </Pressable>
  );
}

// TMDb lifecycle strings → short labels for the "Status" info row. null for
// unknown/empty so the row drops out rather than printing a raw API value.
function prettyStatus(status?: string): string | null {
  switch (status) {
    case 'Returning Series': return 'Returning';
    case 'Ended': return 'Ended';
    case 'Canceled': return 'Canceled';
    case 'In Production': return 'In production';
    case 'Planned': return 'Upcoming';
    case 'Pilot': return 'Pilot';
    default: return status ?? null;
  }
}

// US content rating (TV-MA / TV-14 / ...) from the appended content_ratings.
// Empty/missing → null so it drops out of the meta line.
function usRating(c?: TmdbPayload): string | null {
  const us = c?.content_ratings?.results?.find((r) => r.iso_3166_1 === 'US');
  return us?.rating || null;
}

// US subscription-streaming providers ("where to watch"), sorted by TMDb's
// display priority. Empty when TMDb has no US streaming data for the title.
// TMDb lists tier variants as separate providers ("Netflix" + "Netflix Standard
// with Ads"); collapse them to one logo per brand (first word) so we don't show
// two near-identical logos, keeping the highest-priority variant.
function usProviders(c?: TmdbPayload): WatchProvider[] {
  const flatrate = c?.['watch/providers']?.results?.US?.flatrate ?? [];
  const sorted = [...flatrate].sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99));
  const seen = new Set<string>();
  const out: WatchProvider[] = [];
  for (const p of sorted) {
    const brand = p.provider_name.split(' ')[0].toLowerCase();
    if (seen.has(brand)) continue;
    seen.add(brand);
    out.push(p);
  }
  return out;
}

// "2026-05-31" → "May 31, 2026". Parse parts by hand (not new Date(iso), which
// reads the string as UTC midnight → off-by-one in negative-offset timezones).
function formatAirDate(iso?: string): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  heroWrap: { alignItems: 'center', marginTop: 16 },
  meta: { fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginTop: 10 },
  tagline: {
    fontFamily: fonts.regular, fontSize: 14, fontStyle: 'italic',
    textAlign: 'center', marginTop: 8, paddingHorizontal: pad,
  },
  // Overview info table (status / aired / available on) — left-aligned, label column.
  infoBlock: { paddingHorizontal: pad, paddingTop: 16, gap: 9 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoRowTop: { alignItems: 'flex-start' },
  infoLabel: { width: 104, fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  infoValue: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  // Awards is a sentence, not a short value → regular weight + line height.
  infoAwards: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.ink, lineHeight: 18 },
  infoLogos: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLogo: { width: 26, height: 26, borderRadius: 6 },
  kickerRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 16,
  },
  statWrap: { marginTop: 20, marginBottom: 16 },

  // Summary + cast (below the tabs)
  sectionTitle: { paddingHorizontal: pad, paddingTop: 18, paddingBottom: 8 },
  summary: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    lineHeight: 21,
    paddingHorizontal: pad,
  },
  castGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CAST_GAP, paddingHorizontal: pad, paddingBottom: 8 },
  castPhoto: { backgroundColor: colors.cream }, // width/height/radius applied inline per cell
  castPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },

  muted: { fontFamily: fonts.regular, color: colors.muted },
  center: { padding: pad, textAlign: 'center' },
});
