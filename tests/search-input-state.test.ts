import { describe, expect, it } from 'vitest'
import {
  initialSearchInputState,
  markRequested,
  pendingQuery,
  syncFromUrl,
  typed,
  type SearchInputState,
} from '@/lib/search-input-state'

// What the component's debounce effect does when its timer fires: it asks the
// router for the query the state says is owed, and records it as requested.
function debounceFires(state: SearchInputState): SearchInputState {
  const owed = pendingQuery(state)
  if (owed === null) throw new Error('debounce fired with nothing owed')
  return markRequested(state, owed)
}

describe('pendingQuery', () => {
  it('owes a navigation when the trimmed text differs from what was last requested', () => {
    const state = typed(initialSearchInputState(''), 'matrix')
    expect(pendingQuery(state)).toBe('matrix')
  })

  it('owes nothing when typing lands back on the current URL query', () => {
    const state = typed(initialSearchInputState('matrix'), 'matrix')
    expect(pendingQuery(state)).toBeNull()
  })

  it('trims for the comparison but keeps the raw text as the visible value', () => {
    const state = typed(initialSearchInputState('matrix'), 'matrix ')
    expect(state.value).toBe('matrix ')
    expect(pendingQuery(state)).toBeNull()
  })

  it('owes nothing on mount, including when the URL carried repeated q values', () => {
    // `?q=a&q=b` — the page reads the first value, so the input mounts on "a".
    // Requesting "a" here would be a commit to the URL already showing, which
    // is the no-op commit that used to strand the previous design.
    expect(pendingQuery(initialSearchInputState('a'))).toBeNull()
  })
})

describe('no-op commits are never requested', () => {
  it('cancels the owed navigation when a keystroke returns to the requested query', () => {
    // At /search?q=dune: type "dunex", backspace to "dune" inside the 300ms
    // window. The timer is still armed for "dunex" when the backspace lands.
    let state = initialSearchInputState('dune')
    state = typed(state, 'dunex')
    expect(pendingQuery(state)).toBe('dunex')

    state = typed(state, 'dune')
    expect(pendingQuery(state)).toBeNull()
  })

  it('still adopts an external URL change after that near-miss (the Critical)', () => {
    // The sequence above, then the header's <Link href="/search"> is clicked.
    // The previous design left `pending` non-null forever here and ignored
    // this, leaving "dune" in the box against an empty URL and empty results.
    let state = initialSearchInputState('dune')
    state = typed(state, 'dunex')
    state = typed(state, 'dune')

    state = syncFromUrl(state, '')
    expect(state).toEqual({ value: '', requested: '' })
  })

  it('still adopts a Back navigation after a type-then-delete near-miss (the Critical)', () => {
    // From /search?q=alien: header link clears the query, the user types "a"
    // and deletes it within 300ms, then presses Back.
    let state = initialSearchInputState('alien')
    state = syncFromUrl(state, '')
    expect(state).toEqual({ value: '', requested: '' })

    state = typed(state, 'a')
    expect(pendingQuery(state)).toBe('a')
    state = typed(state, '')
    expect(pendingQuery(state)).toBeNull()

    state = syncFromUrl(state, 'alien')
    expect(state).toEqual({ value: 'alien', requested: 'alien' })
  })

  it('owes nothing once the debounce has requested the current text', () => {
    // Settling happens when the navigation is requested, not when it lands,
    // so nothing depends on observing a URL change that may never come.
    let state = typed(initialSearchInputState(''), 'matrix')
    state = debounceFires(state)
    expect(pendingQuery(state)).toBeNull()

    // And it stays settled even though the URL has not caught up yet.
    expect(pendingQuery(state)).toBeNull()
  })
})

describe('syncFromUrl', () => {
  it('adopts an external URL change while idle', () => {
    const idle = initialSearchInputState('')
    expect(syncFromUrl(idle, 'dune')).toEqual({ value: 'dune', requested: 'dune' })
  })

  it('leaves the box untouched when the query we requested finally lands', () => {
    let state = typed(initialSearchInputState(''), 'matrix')
    state = debounceFires(state)
    expect(syncFromUrl(state, 'matrix')).toBe(state)
  })

  it('does not overwrite raw typed text with the trimmed URL value when our own commit lands', () => {
    // Trailing whitespace the user typed is not part of the requested query,
    // but it must survive the commit — otherwise typing on gives "starwars".
    let state = typed(initialSearchInputState(''), 'star ')
    expect(pendingQuery(state)).toBe('star')
    state = debounceFires(state)

    state = syncFromUrl(state, 'star')
    expect(state.value).toBe('star ')

    state = typed(state, 'star wars')
    expect(pendingQuery(state)).toBe('star wars')
  })

  it('ignores a stale commit that does not match the latest keystroke (the clobber)', () => {
    // Typed "matr", the debounce fired, its navigation is in flight.
    let state = typed(initialSearchInputState(''), 'matr')
    state = debounceFires(state)

    // Before it commits, the user types on to "matrix".
    state = typed(state, 'matrix')
    expect(pendingQuery(state)).toBe('matrix')

    // The "matr" commit lands late. It must not overwrite what is on screen.
    const afterStale = syncFromUrl(state, 'matr')
    expect(afterStale).toBe(state)
    expect(afterStale.value).toBe('matrix')
    expect(pendingQuery(afterStale)).toBe('matrix')
  })

  it('keeps a deletion that races an earlier, still-uncommitted navigation', () => {
    // Typed "matr", the debounce fired, its navigation is in flight.
    let state = typed(initialSearchInputState(''), 'matr')
    state = debounceFires(state)

    // The user clears the box before it commits.
    state = typed(state, '')
    expect(pendingQuery(state)).toBe('')

    // The stale "matr" commit lands. It must not refill the box or resume a
    // search the user already cancelled.
    state = syncFromUrl(state, 'matr')
    expect(state.value).toBe('')
    expect(pendingQuery(state)).toBe('')

    // Our own clear is requested and lands; the box stays empty.
    state = debounceFires(state)
    state = syncFromUrl(state, '')
    expect(state).toEqual({ value: '', requested: '' })
  })

  it('does not strand a debounce: retyping the same query after an external nav still navigates', () => {
    let state = initialSearchInputState('')

    state = typed(state, 'alien')
    state = debounceFires(state)
    state = syncFromUrl(state, 'alien')
    expect(state).toEqual({ value: 'alien', requested: 'alien' })

    // Header-link click clears the query out from under the input.
    state = syncFromUrl(state, '')
    expect(state).toEqual({ value: '', requested: '' })

    // User retypes "alien"; before its debounce fires, a Back navigation
    // independently lands on a URL that happens to read "alien" too.
    state = typed(state, 'alien')
    expect(pendingQuery(state)).toBe('alien')
    state = syncFromUrl(state, 'alien')
    expect(state).toEqual({ value: 'alien', requested: 'alien' })
    expect(pendingQuery(state)).toBeNull()

    // The next real keystroke must still owe a navigation.
    state = typed(state, 'aliens')
    expect(pendingQuery(state)).toBe('aliens')
  })
})
