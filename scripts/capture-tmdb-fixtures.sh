#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

set -a; . ./.env.local; set +a
OUT=tests/fixtures/tmdb
mkdir -p "$OUT"

fetch() {
  local name="$1" path="$2"
  curl -sS --fail-with-body \
    -H "Authorization: Bearer ${TMDB_ACCESS_TOKEN}" \
    -H "accept: application/json" \
    "https://api.themoviedb.org/3${path}" > "${OUT}/${name}.json"
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
