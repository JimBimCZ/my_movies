export interface SearchInputState {
  value: string
  pending: string | null
}

export function initialSearchInputState(urlQuery: string): SearchInputState {
  return { value: urlQuery, pending: null }
}

export function typed(state: SearchInputState, urlQuery: string, text: string): SearchInputState {
  const trimmed = text.trim()
  if (state.pending === null && trimmed === urlQuery) {
    return { value: text, pending: null }
  }
  return { value: text, pending: trimmed }
}

export function syncFromUrl(state: SearchInputState, urlQuery: string): SearchInputState {
  if (state.pending === urlQuery) {
    return { value: state.value, pending: null }
  }
  if (state.pending === null) {
    return { value: urlQuery, pending: null }
  }
  return state
}
