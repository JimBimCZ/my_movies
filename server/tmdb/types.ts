export type MediaType = 'movie' | 'tv'

export interface PagedResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export interface Genre {
  id: number
  name: string
}

export interface MovieListItem {
  adult: boolean
  backdrop_path: string | null
  genre_ids: number[]
  id: number
  original_language: string
  original_title: string
  overview: string
  popularity: number
  poster_path: string | null
  release_date: string
  softcore: boolean
  title: string
  video: boolean
  vote_average: number
  vote_count: number
}

export interface TvListItem {
  adult: boolean
  backdrop_path: string | null
  first_air_date: string
  genre_ids: number[]
  id: number
  name: string
  origin_country: string[]
  original_language: string
  original_name: string
  overview: string
  popularity: number
  poster_path: string | null
  softcore: boolean
  vote_average: number
  vote_count: number
}

export type TrendingItem =
  | (MovieListItem & { media_type: 'movie' })
  | (TvListItem & { media_type: 'tv' })

export interface PersonSearchResult {
  adult: boolean
  gender: number
  id: number
  known_for: TrendingItem[]
  known_for_department: string
  media_type: 'person'
  name: string
  original_name: string
  popularity: number
  profile_path: string | null
}

export type SearchResultItem = TrendingItem | PersonSearchResult

export interface MovieDetail {
  adult: boolean
  backdrop_path: string | null
  budget: number
  genres: Genre[]
  homepage: string
  id: number
  imdb_id: string | null
  origin_country: string[]
  original_language: string
  original_title: string
  overview: string
  popularity: number
  poster_path: string | null
  production_companies: ProductionCompany[]
  release_date: string
  revenue: number
  runtime: number
  softcore: boolean
  status: string
  tagline: string
  title: string
  video: boolean
  vote_average: number
  vote_count: number
}

export interface TvDetail {
  adult: boolean
  backdrop_path: string | null
  created_by: Creator[]
  episode_run_time: number[]
  first_air_date: string
  genres: Genre[]
  homepage: string
  id: number
  in_production: boolean
  languages: string[]
  last_air_date: string | null
  name: string
  networks: Network[]
  number_of_episodes: number | null
  number_of_seasons: number
  origin_country: string[]
  original_language: string
  original_name: string
  overview: string
  popularity: number
  poster_path: string | null
  softcore: boolean
  status: string
  tagline: string
  type: string
  vote_average: number
  vote_count: number
}

export interface ProductionCompany {
  id: number
  logo_path: string | null
  name: string
  origin_country: string
}

export interface Network {
  id: number
  logo_path: string | null
  name: string
  origin_country: string
}

export interface Creator {
  credit_id: string
  gender: number
  id: number
  name: string
  original_name: string
  profile_path: string | null
}

export interface CastMember {
  adult: boolean
  cast_id?: number
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path: string | null
  character: string
  credit_id: string
  order: number
}

export interface CrewMember {
  adult: boolean
  gender: number
  id: number
  known_for_department: string
  name: string
  original_name: string
  popularity: number
  profile_path: string | null
  credit_id: string
  department: string
  job: string
}

export interface Credits {
  cast: CastMember[]
  crew: CrewMember[]
}

export interface Video {
  id: string
  iso_639_1: string
  iso_3166_1: string
  key: string
  name: string
  official: boolean
  published_at: string
  site: string
  size: number
  type: string
}

export interface ImageAsset {
  aspect_ratio: number
  file_path: string
  height: number
  iso_639_1: string | null
  iso_3166_1: string | null
  vote_average: number
  vote_count: number
  width: number
}

export interface TitleImages {
  backdrops: ImageAsset[]
  logos: ImageAsset[]
  posters: ImageAsset[]
}

export interface AppendedTitleData {
  credits: Credits
  videos: { results: Video[] }
  images: TitleImages
}

export type MovieDetailFull = MovieDetail & AppendedTitleData
export type TvDetailFull = TvDetail & AppendedTitleData

export interface TmdbConfiguration {
  images: {
    base_url: string
    secure_base_url: string
    backdrop_sizes: string[]
    logo_sizes: string[]
    poster_sizes: string[]
    profile_sizes: string[]
    still_sizes: string[]
  }
}
