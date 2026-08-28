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

// Holds one request, not a queue. Two of our own commits landing out of order
// would read as external and clobber the box — but that cannot happen: Next's
// router supersedes an in-flight navigation rather than racing it, measured at
// five overlap offsets.
export function syncFromUrl(state: SearchInputState, urlQuery: string): SearchInputState {
  if (urlQuery === state.requested) return state
  return { value: urlQuery, requested: urlQuery }
}
