export interface SearchInputState {
  value: string
  requested: string
}

export function initialSearchInputState(urlQuery: string): SearchInputState {
  return { value: urlQuery, requested: urlQuery }
}

export function typed(state: SearchInputState, text: string): SearchInputState {
  return { value: text, requested: state.requested }
}

export function pendingQuery(state: SearchInputState): string | null {
  const trimmed = state.value.trim()
  return trimmed === state.requested ? null : trimmed
}

// Called when the navigation is *requested*, not when the URL commits — a
// commit can be hundreds of milliseconds late, and settling on it is what
// made a no-op commit strand the previous design.
export function markRequested(state: SearchInputState, query: string): SearchInputState {
  return { value: state.value, requested: query }
}

// `requested` is the only thing that tells our own navigation landing apart
// from one we did not cause: an incoming query we already asked for is that
// landing, and must leave the box exactly as typed. Anything else is
// external, and replaces the box. This holds one request, not a queue, so a
// pair of our own commits arriving out of order would read as external and
// clobber; the 300ms debounce keeps two of ours in flight only briefly, and
// every commit observed in a throttled browser has been ordered.
export function syncFromUrl(state: SearchInputState, urlQuery: string): SearchInputState {
  if (urlQuery === state.requested) return state
  return { value: urlQuery, requested: urlQuery }
}
