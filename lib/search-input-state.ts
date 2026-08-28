export interface SearchInputState {
  value: string
  pending: string | null
}

export function initialSearchInputState(urlQuery: string): SearchInputState {
  return { value: urlQuery, pending: null }
}

export function typed(urlQuery: string, text: string): SearchInputState {
  const trimmed = text.trim()
  return { value: text, pending: trimmed === urlQuery ? null : trimmed }
}

export function syncFromUrl(state: SearchInputState, urlQuery: string): SearchInputState {
  if (state.pending === null || state.pending === urlQuery) {
    return { value: urlQuery, pending: null }
  }
  return state
}
