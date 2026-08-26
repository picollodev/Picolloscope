import {StyleSheet, css} from 'aphrodite'
import {h, createContext, ComponentChildren, Fragment} from 'preact'
import {useCallback, useRef, useEffect, useMemo} from 'preact/hooks'
import {memo} from 'preact/compat'
import {Sizes, FontSize} from './style'
import {ProfileSearchResults} from '../lib/profile-search'
import {Profile} from '../lib/profile'
import {useActiveProfileState} from '../app-state/active-profile-state'
import {useTheme, withTheme} from './themes/theme'
import {metadataFormattingAtom, searchIsActiveAtom, searchQueryAtom} from '../app-state'
import {useAtom} from '../lib/atom'

function stopPropagation(ev: Event) {
  ev.stopPropagation()
}

export const ProfileSearchContext = createContext<ProfileSearchResults | null>(null)

export const ProfileSearchContextProvider = ({children}: {children: ComponentChildren}) => {
  const activeProfileState = useActiveProfileState()
  const profile: Profile | null = activeProfileState ? activeProfileState.profile : null
  const searchIsActive = useAtom(searchIsActiveAtom)
  const searchQuery = useAtom(searchQueryAtom)
  const metadataFormatting = useAtom(metadataFormattingAtom)

  const searchResults = useMemo(() => {
    if (!profile || !searchIsActive || searchQuery.length === 0) {
      return null
    }
    return new ProfileSearchResults(profile, searchQuery, metadataFormatting)
  }, [searchIsActive, searchQuery, profile, metadataFormatting])

  return <ProfileSearchContext.Provider value={searchResults}>{children}</ProfileSearchContext.Provider>
}

interface SearchViewProps {
  resultIndex: number | null
  numResults: number | null
  selectNext: () => void
  selectPrev: () => void
}

export const SearchView = memo(({numResults, resultIndex, selectNext, selectPrev}: SearchViewProps) => {
  const theme = useTheme()
  const style = getStyle(theme)
  const searchIsActive = useAtom(searchIsActiveAtom)
  const searchQuery = useAtom(searchQueryAtom)
  const setSearchQuery = searchQueryAtom.set
  const setSearchIsActive = searchIsActiveAtom.set

  const onInput = useCallback(
    (ev: Event) => {
      const value = (ev.target as HTMLInputElement).value
      setSearchQuery(value)
    },
    [setSearchQuery],
  )

  const inputRef = useRef<HTMLInputElement | null>(null)

  const close = useCallback(() => setSearchIsActive(false), [setSearchIsActive])

  const selectPrevOrNextResult = useCallback(
    (ev: KeyboardEvent) => {
      if (ev.shiftKey) {
        selectPrev()
      } else {
        selectNext()
      }
    },
    [selectPrev, selectNext],
  )

  const onKeyDown = useCallback(
    (ev: KeyboardEvent) => {
      ev.stopPropagation()

      // Hitting Esc should close the search box
      if (ev.key === 'Escape') {
        setSearchIsActive(false)
      }

      if (ev.key === 'Enter') {
        selectPrevOrNextResult(ev)
      }

      if (ev.key == 'f' && (ev.metaKey || ev.ctrlKey)) {
        if (inputRef.current) {
          // If the input is already focused, select all
          inputRef.current.select()
        }

        // It seems like when an input is focused, the browser find menu pops
        // up without this line. It seems like it's not sufficient to only
        // preventDefault in the window keydown handler.
        ev.preventDefault()
      }
    },
    [setSearchIsActive, selectPrevOrNextResult],
  )

  useEffect(() => {
    const onWindowKeyDown = (ev: KeyboardEvent) => {
      // Cmd+F or Ctrl+F open the search box
      if (ev.key == 'f' && (ev.metaKey || ev.ctrlKey)) {
        // Prevent the browser's search menu from appearing
        ev.preventDefault()

        if (inputRef.current) {
          // If the search box is already open, then re-select it immediately.
          inputRef.current.select()
        } else {
          // Otherwise, focus the search, then focus the input on the next
          // frame, when the search box should have mounted.
          setSearchIsActive(true)
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.select()
            }
          })
        }
      }
    }

    window.addEventListener('keydown', onWindowKeyDown)
    return () => {
      window.removeEventListener('keydown', onWindowKeyDown)
    }
  }, [setSearchIsActive])

  if (!searchIsActive) return null

  return (
    <div className={css(style.searchView)} title='Search'>
      <span className={css(style.icon)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-code-icon lucide-search-code"><path d="m13 13.5 2-2.5-2-2.5"/><path d="m21 21-4.3-4.3"/><path d="M9 8.5 7 11l2 2.5"/><circle cx="11" cy="11" r="8"/></svg>
      </span>
      <span className={css(style.inputContainer)}>
        <input
          className={css(style.input)}
          value={searchQuery}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onKeyUp={stopPropagation}
          onKeyPress={stopPropagation}
          ref={inputRef}
        />
      </span>
      {numResults != null && (
        <Fragment>
          <span className={css(style.resultCount)}>
            {resultIndex == null ? '?' : resultIndex + 1}/{numResults}
          </span>
          <button className={css(style.icon, style.button)} onClick={selectPrev} title='Previous'>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left-icon lucide-chevron-left"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button className={css(style.icon, style.button)} onClick={selectNext} title='Next'>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right-icon lucide-chevron-right"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </Fragment>
      )}
      <button className={css(style.icon, style.button)} onClick={close} title='Close'>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>
    </div>
  )
})

const getStyle = withTheme(theme =>
  StyleSheet.create({
    searchView: {
      position: 'absolute',
      top: 5,
      right: 5,
      height: Sizes.TOOLBAR_HEIGHT,
      width: 350,
      fontSize: FontSize.LABEL,
      boxSizing: 'border-box',
      background: theme.altBgPrimaryColor,
      color: theme.altFgPrimaryColor,
      display: 'flex',
      alignItems: 'center',
    },
    inputContainer: {
      flexShrink: 1,
      flexGrow: 1,
      display: 'flex',
    },
    input: {
      width: '100%',
      border: 'none',
      background: 'none',
      fontSize: FontSize.LABEL,
      lineHeight: `${Sizes.TOOLBAR_HEIGHT}px`,
      height: Sizes.TOOLBAR_HEIGHT,
      padding: 0,
      color: theme.altFgPrimaryColor,
      ':focus': {
        border: 'none',
        outline: 'none',
      },
      '::selection': {
        color: theme.altFgPrimaryColor,
        background: theme.selectionPrimaryColor,
      },
    },
    resultCount: {
      verticalAlign: 'middle',
      lineHeight: `${Sizes.TOOLBAR_HEIGHT}px`,
      marginRight: 5
    },
    icon: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      verticalAlign: 'middle',
      width: 20,
      height: 20,
      border: 0,
      padding: 1,
      color: theme.altFgPrimaryColor,
    },
    button: {
      background: 'transparent',
      cursor: 'pointer',
      ':hover': {
        background: '#555555',
      },
      ':focus': {
        outline: 'none',
      },
    },
  }),
)
