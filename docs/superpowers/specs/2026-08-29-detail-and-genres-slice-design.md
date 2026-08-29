# Slice 4 — A detail page worth reading, and genre navigation

Date: 2026-08-29
Status: designed

## Context

Slices 1–3 built the browse path: TMDB rows on `/`, search, a title detail page, a
watchlist, cache-tag revalidation, an accessibility pass, and CI. The detail page that
came out of slice 1 is a stub — backdrop, poster, title, year, rating, genre pills, a
one-paragraph overview, and the watchlist button. It shows nothing about who made the
film or who is in it, has no trailer, and renders exactly one image.

Navigation is equally thin. `/` renders rows for the first four movie genres, hardcoded
by array position in `app/page.tsx`, and there is no way to reach the other fifteen.

This slice does three things: fixes two visual defects on the existing detail page,
fills that page out from TMDB's credits/videos/images data, and adds genre navigation
from the header.

Scope explicitly excludes person pages, image lightboxes, pagination on genre pages, and
any change to the home page's genre rows.

## Verified against the live API

Everything below was fetched during design, not recalled. The two payloads become test
fixtures.

**`append_to_response` collapses four requests into one.** `GET /movie/27205?
append_to_response=credits,videos,images&include_image_language=en,null` returns
`credits` (`cast`, `crew`), `videos.results`, and `images` (`backdrops`, `logos`,
`posters`) inline alongside the detail fields. The same works for `/tv/1396`.

**Movie and TV genre lists do not share IDs.** `/genre/movie/list` returns 19 genres,
`/genre/tv/list` returns 16. Action is `28` for movies; TV has no Action, only
"Action & Adventure" `10759`. "Science Fiction" `878` has no TV counterpart either —
TV has "Sci-Fi & Fantasy" `10765`. Exactly eight names appear on both sides — Animation,
Comedy, Crime, Documentary, Drama, Family, Mystery, Western — and for all eight the ID is
the same on both sides, which is what makes a name-keyed merge safe. Everything else is
one-sided, including War (`10752`, movie only) against War & Politics (`10768`, TV only).
The union is 27 names. Any design that assumes one genre ID space is wrong.

**Movies and TV diverge structurally.**

| | Movie (`/movie/27205`) | TV (`/tv/1396`) |
|---|---|---|
| Director | `crew[].job === 'Director'` → Christopher Nolan | no `Director` job in `crew`; `created_by[]` → Vince Gilligan |
| Length | `runtime: 148` | `episode_run_time: []` (empty), `number_of_seasons: 5`, `number_of_episodes: 62` |
| Date | `release_date` | `first_air_date` |
| Studio | `production_companies[]` | `networks[]` |
| Cast size | 52 | 8 |
| Videos | 27 | **0** |

`episode_run_time` being empty and `videos` being zero are both real responses from a
famous show, not edge cases to be discovered in production. Every section must render
correctly when its data is absent.

**Video shape**: `{ key, site, type, official, published_at, name, iso_639_1 }`. Types
seen include `Trailer`, `Teaser`, `Clip`, `Featurette`, `Behind the Scenes`; `official`
is both `true` and `false` within one title.

**Image shape**: `{ file_path, width, height, aspect_ratio, vote_average, vote_count,
iso_639_1 }`. Inception returns 82 backdrops, 75 posters; Breaking Bad returns 133
backdrops.

## Decisions

Resolved with the human before design. Recorded so a later reader does not reopen them.

### Genres merge by name into one list

The menu shows a single alphabetical list of every genre name from either side (27
entries), not two lists split by medium. A genre page renders a Movies row and a Series
row; a name that exists on only one side renders only that row.

The alternative — a menu split into "Movies" and "TV" columns — is more honest to TMDB's
model but cannot satisfy the requirement that one click produces both a movie row and a
series row. The alternative of showing only movie genres and matching TV by name would
leave ten of the nineteen genres with no Series row.

Consequence accepted: "Action" and "Action & Adventure" appear as two separate entries,
as do "Science Fiction" and "Sci-Fi & Fantasy", and "War" and "War & Politics". Merging
those pairs by hand would mean a hardcoded synonym table that TMDB can invalidate at any
time. The duplication is honest; a synonym table would be a lie with a maintenance cost.

### Cast is not clickable

No `/person/[id]` route, no TMDB person endpoints. Cast renders as photo, name, and
character. Adding person pages later is additive and touches nothing here.

### The trailer loads on click, not on view

A thumbnail with a play button; the `youtube-nocookie.com` iframe mounts only after the
click. The alternative — an iframe in the initial HTML — pulls the YouTube player
bundle and sets third-party cookies on every detail view, for a video most visitors will
not play. A modal was rejected as focus-trap machinery for no gain over inline playback.

### TV gets full parity, with TV equivalents

Creator instead of director, seasons and episodes instead of runtime, network instead of
production company, first-aired instead of released. The app links to TV titles from
Trending and Airing Today; a detail page that looks half-built on those is not
acceptable.

### One appended request replaces the plain detail request

`getTitleDetail` switches to the `append_to_response` URL. It keeps the existing
`tmdb:title:<mediaType>:<id>` tag and `REVALIDATE.detail`, so `/api/revalidate` and
`isKnownTag` need no change for this part.

Consequence accepted: the request URL changes, so cached entries for the old URL are
orphaned. They are unreachable and expire on their own.

### The header becomes a data-fetching component

`SiteHeader` lives in the root layout, so fetching the merged genre list there means
every page depends on it. Both genre lists carry `REVALIDATE.genres` (24h) and are
deduped within a render, so the real cost is two TMDB requests per day. Accepted; the
alternative is a client-side fetch on first hover, which trades a build-time-free cost
for a runtime waterfall and a loading state inside a menu.

## Architecture

### Slice A — UI fixes

**The backdrop paints over the content.** `app/title/[mediaType]/[id]/page.tsx:63` is a
`relative` block; the content container at line 70 is static with `-mt-24`. In CSS paint
order, positioned elements with `z-index: auto` paint after non-positioned block
descendants regardless of DOM order — so the backdrop covers the top of the poster and
the genre pills. This is a stacking bug, not a spacing bug: adding margin would only
hide the symptom. Fix: `relative z-10` on the content container.

**The header is illegible over a bright backdrop.** `components/site-header.tsx:9`
scrims with `from-black/80 to-transparent`, which fades out within the header's own
height, and the links are `--muted` (`#9b9ba3`). Fix: deepen and lengthen the scrim, and
move the links to the foreground colour, using muted only as the hover-from state.

Contrast is a measurable claim, so it is measured in the browser against a real bright
backdrop rather than asserted. Both fixes are verified visually as well — they are
visual defects, and a passing build proves nothing about either.

### Slice B — Rich detail page

**Server.** `server/tmdb/types.ts` gains `CastMember`, `CrewMember`, `Credits`, `Video`,
`ImageAsset`, and `TitleImages`, plus the detail fields now rendered (`budget`,
`revenue`, `production_companies`, `spoken_languages` on `MovieDetail`; `created_by`,
`networks`, `seasons`, `last_episode_to_air` on `TvDetail`). Every field is copied from
the two fetched payloads.

`server/tmdb/endpoints/titles.ts` adds the `append_to_response` search params. The
returned type becomes `MovieDetail & { credits; videos; images }`.

`server/tmdb/images.ts` gains `PROFILE_SLOTS = { card: 185 }` and
`BACKDROP_SLOTS.still = 780`, feeding the existing `pickSize`.

**`lib/title-detail.ts`** — a pure view-model layer, no I/O, so it belongs in `lib/` and
is unit-testable without a network:

- `toTitleFacts(detail)` → `{ director | creator, releaseDate, runtimeLabel, rating,
  voteCount, status, studio, seasonsLabel }`, branching on `media_type`.
- `pickTrailer(videos)` → the newest official YouTube `Trailer`; falls back to a
  `Teaser`, then to any YouTube `Trailer`; returns `null` when nothing qualifies.
- `pickCast(credits, limit)` → top `limit` by `order`.
- `pickBackdrops(images, limit)` → highest `vote_average` first, `vote_count` as
  tiebreak.

**Components.** `title-facts` (server), `cast-row` (server), `backdrop-carousel`
(server) — the last two reuse `RowScroller`, passing server-rendered cards through as
children, which is the pattern CLAUDE.md names. `trailer-player` is the only
`'use client'` addition.

**Page order:** backdrop → poster with title, facts, genres, watchlist → tagline and
full overview → trailer → cast → images. A section whose data is missing does not
render; it is not replaced by an empty state. `loading.tsx` is extended to match.

### Slice C — Genres

**`lib/genres.ts`** — pure: `slugify(name)` and `mergeGenres(movieGenres, tvGenres)` →
`{ slug, name, movieId?, tvId? }[]`, alphabetical.

**`server/tmdb/endpoints/genres.ts`** — `getMergedGenres()` fetches both lists and
applies the merge. `getTvGenres()` and `discoverTvByGenre()` join the existing movie
equivalents in `lists.ts`.

**Cache.** `ListName` gains `` `tv-genre-${number}` `` and `LIST_TAG` in
`isKnownTag` is extended in the same commit. CLAUDE.md requires the validator to be
extended alongside any new tag builder, or the new family cannot be purged.

**`app/genre/[slug]/page.tsx`** resolves the slug against the merged list, `notFound()`s
on an unknown one, and renders each available row inside its own `Suspense` with the
existing `RowSkeleton`. `generateMetadata` names the genre.

**`components/genres-menu.tsx`** is a disclosure, not a hover-only dropdown: it opens on
pointer hover *and* on click or Enter, closes on Escape, outside click, or focus leaving
the menu, and carries `aria-expanded` and `aria-controls`. Hover alone is unreachable by
keyboard and unusable on touch. The panel is a scrollable multi-column grid with a
max-height. `SiteHeader` fetches the list and passes it as a plain-data prop, so the
client component never imports from `server/`.

## Testing

- `lib/title-detail.ts` and `lib/genres.ts` — unit tests over the two saved fixtures,
  covering the branches the live API proved real: a TV title with no videos, an empty
  `episode_run_time`, a genre present on only one side.
- `server/tmdb` endpoint tests — the appended request URL carries both search params and
  the correct tag; `isKnownTag` accepts `tv-genre-<id>` and still rejects unknown tags.
- Component tests follow the existing pattern in `tests/`.
- The three visual outcomes — header legibility, detail stacking, the genre menu opening
  by keyboard — are verified in a browser, because none of them is provable by a
  passing test suite.

`pnpm build`, `pnpm lint`, `pnpm typecheck` and `pnpm test` pass before each slice is
called done.

## Delivery

Three branches, three PRs, each independently deployable:

1. `slice-4-ui-fixes` — the two visual defects.
2. `slice-4-detail` — credits, videos, images, and the page that renders them.
3. `slice-4-genres` — the merged genre list, the menu, and `/genre/[slug]`.
