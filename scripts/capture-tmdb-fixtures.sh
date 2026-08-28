#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required but not installed." >&2
  echo "  macOS: brew install jq" >&2
  echo "  Linux: apt-get install jq (or your distro's equivalent)" >&2
  exit 1
fi

set -a; . ./.env.local; set +a
OUT=tests/fixtures/tmdb
mkdir -p "$OUT"

# --fail-with-body writes the error object to stdout, so a non-2xx would clobber a
# known-good committed fixture if curl wrote to the real path.
trap 'rm -f "${OUT}"/*.json.tmp "${OUT}"/*.json.raw.tmp' EXIT

fetch() {
  local name="$1" path="$2"
  # bash 3.2 (macOS default) cannot reference an earlier `local` in the same statement
  # under set -u, so tmp is declared separately.
  local tmp="${OUT}/${name}.json.tmp"
  local raw="${OUT}/${name}.json.raw.tmp"
  # An `a > tmp && mv` one-liner would be exempt from set -e and swallow the failure.
  if ! curl -sS --fail-with-body \
    -H "Authorization: Bearer ${TMDB_ACCESS_TOKEN}" \
    -H "accept: application/json" \
    "https://api.themoviedb.org/3${path}" > "$raw"; then
    echo "failed to capture ${name}; ${OUT}/${name}.json left unchanged" >&2
    return 1
  fi
  jq . "$raw" > "$tmp"
  mv "$tmp" "${OUT}/${name}.json"
  echo "captured ${name}"
}

fetch configuration   "/configuration"
fetch trending        "/trending/all/week"
fetch now-playing     "/movie/now_playing"
fetch top-rated       "/movie/top_rated"
fetch airing-today    "/tv/airing_today"
fetch genres-movie    "/genre/movie/list"
fetch discover-movie  "/discover/movie?with_genres=28"
fetch movie-detail    "/movie/27205"
fetch tv-detail       "/tv/1396"
fetch search-multi    "/search/multi?query=matrix"
