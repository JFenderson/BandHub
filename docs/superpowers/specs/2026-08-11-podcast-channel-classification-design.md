# Podcast Channel Classification — Design

## Problem

YouTube channels that run HBCU-band-focused podcasts/talk shows (e.g., interview and
discussion content that names specific bands/schools in the title) are being pulled into
BandHub and misclassified as band videos:

1. Unregistered podcast channels have every video independently classified/matched by
   title/description. A title like "Coach Talks Jackson State Band Culture" can trick the
   matcher into attaching the video to JSU.
2. The AI classifier (`band-librarian.service.ts`) already has a `PODCAST` exclusion rule,
   but it's under-specified and misses real cases — some podcast videos aren't being tagged
   as podcasts at all.
3. `ContentCreator` (today used for multi-band videographer channels like "Killa Kev") gives
   a channel a profile page, but registering a channel this way does **not** stop its videos
   from being AI-matched to a band — there's no channel-level type distinction.

## Goals

- Give podcast/talk-show channels a defined type and a profile, distinct from multi-band
  videographer channels.
- Stop new podcast-channel videos from leaking onto band pages, while still allowing genuine
  high-confidence game footage (e.g., a podcast occasionally reposting real footage) to match.
- Clean up videos from newly-registered podcast channels that are already wrongly attached to
  bands today.
- Improve the classifier prompt so podcast-style content is caught even on channels that
  aren't explicitly registered.

## Non-goals

- Automatic/AI-driven discovery of new podcast channels (out of scope; manual curation only,
  matching the existing `link-creator-channels.ts` workflow).
- A general channel-type taxonomy beyond `VIDEOGRAPHER` / `PODCAST` (no `NEWS`, `OFFICIAL`,
  etc. — YAGNI; official channels are already handled via `Band.youtubeChannelId`).
- A recurring/scheduled cleanup job — the backfill cleanup runs once, at registration time,
  per channel.

## Design

### A. Data model & registration

- Add `channelType` to `ContentCreator`: enum `VIDEOGRAPHER` (default) | `PODCAST`.
  Migration backfills all existing rows to `VIDEOGRAPHER`.
- New script `apps/api/scripts/core/register-podcast-channels.ts`, modeled on
  `apps/api/scripts/core/link-creator-channels.ts`:
  - Curated `KNOWN_PODCAST_CHANNELS` array (`channelId`, `name`, `description`) maintained by
    hand as new podcast channels are spotted.
  - Dry-run by default; `--apply` to write.
  - Upserts a `ContentCreator` row per entry with `channelType: 'PODCAST'` (creates if
    missing, updates the type if the creator already exists as a `VIDEOGRAPHER`).
  - After registration, the existing `backfill-creators` job (unchanged) syncs the channel's
    video catalog and stamps `creatorId` on each video, same as any other creator.

### B. Matching pipeline & backfill cleanup

- `match-videos.processor.ts`: alongside the existing `channelOwnershipMap`, build a
  `podcastChannelSet` of channel IDs for all `ContentCreator`s with `channelType: 'PODCAST'`
  (fetched once per job run).
- In Stage 1 (AI primary path), when `video.channelId` is in `podcastChannelSet`, require a
  higher confidence bar before assigning `bandId`: new constant `PODCAST_MIN_CONFIDENCE = 80`
  vs. the existing blanket `MIN_CONFIDENCE = 50`. Below that bar, the video stays unmatched
  (`bandId: null`, `noMatchReason: 'podcast_channel_low_confidence'`) and is still visible via
  `creatorId` on the channel's own creator profile. Non-podcast channels are unaffected.
- `register-podcast-channels.ts --apply` also re-evaluates every existing `YouTubeVideo` whose
  `channelId` matches a newly-registered podcast channel: any video currently holding a
  `bandId` with `matchConfidence < PODCAST_MIN_CONFIDENCE` is detached (`bandId: null`,
  `opponentBandId: null`, `participantBandIds: []`, `matchSource: null`,
  `noMatchReason: 'podcast_channel_reclassified'`). Videos that were confident matches (e.g.
  genuine game footage reposted by the podcast) are left as-is. This runs once per channel at
  registration time, not on a recurring schedule.

### C. Classifier prompt, UI, testing

- `band-librarian.service.ts`: tighten the `PODCAST` exclusion rule with concrete, checkable
  cues instead of a one-line description:
  - Title patterns: "Ep.", "Episode #", "Podcast", "Talks", "Interview", "Roundtable",
    "Reacts to".
  - Description patterns: mentions of guests, hosts, sponsorships, multi-topic show notes.
  - Explicit instruction: discussion/interview framing about a band outweighs the mere
    presence of a band/school name in the title.
  - This is a prompt-only change (no code structure change) and acts as defense-in-depth
    under the channel-level fix in Part B — it catches one-off podcast-style videos on
    channels that aren't registered at all.
- UI: add a small "Podcast" badge on `CreatorCard.tsx` (next to existing Verified/Featured
  badges) when `creator.channelType === 'PODCAST'`. Expose `channelType` on the `Creator` API
  type and `api-client.ts`. No other UI changes — same `/creators` listing and profile page.

### Testing

- Migration applies cleanly; existing `ContentCreator` rows default to `VIDEOGRAPHER`.
- `register-podcast-channels.ts` dry-run against real podcast channel IDs — confirm the
  upsert plan and the detach-candidate list before running `--apply`.
- Unit test on `match-videos.processor.ts`: a video from a registered podcast channel with
  `confidence: 60` stays unmatched; `confidence: 85` still matches.
- Spot-check the improved classifier prompt against known podcast video titles/descriptions
  previously observed slipping through.
- Manual: after `--apply`, verify affected videos disappear from their previously (wrong)
  band page, and the creator profile page shows the "Podcast" badge.
