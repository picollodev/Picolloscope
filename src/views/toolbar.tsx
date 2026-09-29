import { ApplicationProps } from './application'
import { h, JSX, Fragment } from 'preact'
import { useCallback, useLayoutEffect, useRef, useState, useEffect } from 'preact/hooks'
import { StyleSheet, css } from 'aphrodite'
import { Sizes, FontFamily, FontSize, Duration, ZIndex } from './style'
import { ProfileSelect } from './profile-select'
import { Profile } from '../lib/profile'
import { objectsHaveShallowEquality } from '../lib/utils'
import { colorSchemeToSvg, useTheme, withTheme } from './themes/theme'
import { ViewMode } from '../lib/view-mode'
import { viewModeAtom } from '../app-state'
import { ProfileGroupState } from '../app-state/profile-group'
import { colorSchemeAtom } from '../app-state/color-scheme'
import { useAtom } from '../lib/atom'
import { enableTimelineView } from '../lib/features'

interface ToolbarProps extends ApplicationProps {
  browseForFile(): void
}

const keyboardShortcuts = [
  { keys: '+', action: 'Zoom in' },
  { keys: '-', action: 'Zoom out' },
  { keys: '0', action: 'Zoom out to see the entire profile' },
  { keys: 'arrow keys', action: 'Pan around the profile' },
  ...(enableTimelineView ? [{ keys: 'l', action: 'Switch to the Timeline view' }] : []),
  { keys: 'f', action: 'Switch to the Flamegraph view' },
  { keys: 's', action: 'Switch to the Sandwich view' },
  { keys: 'c', action: 'Switch to the Call tree view' },
  { keys: 'r', action: 'Collapse recursion in the flamegraphs' },
  { keys: 'm', action: 'Cycle method name formatting' },
  { keys: 'n or .', action: 'Go to next profile/thread if one is available' },
  { keys: 'p or ,', action: 'Go to previous profile/thread if one is available' },
  { keys: 't', action: 'Open the profile/thread selector if available' },
  { keys: 'Ctrl/Cmd + O', action: 'Open a new profile' },
  { keys: 'Ctrl/Cmd + F', action: 'Open search. While open, Enter and Shift+Enter cycle through results' },
]

const licenseLinks = [
  { href: 'https://github.com/picollodev/Picolloscope', label: 'GitHub' },
  { href: 'https://github.com/picollodev/Picolloscope/blob/picollo/LICENSE', label: 'License' },
]

function useSetViewMode(setViewMode: (viewMode: ViewMode) => void, viewMode: ViewMode) {
  return useCallback(() => setViewMode(viewMode), [setViewMode, viewMode])
}

function ToolbarLeftContent(props: ToolbarProps) {
  const style = getStyle(useTheme())
  const setChronoFlameChart = useSetViewMode(viewModeAtom.set, ViewMode.CHRONO_FLAME_CHART)
  const setLeftHeavyFlameGraph = useSetViewMode(viewModeAtom.set, ViewMode.LEFT_HEAVY_FLAME_GRAPH)
  const setSandwichView = useSetViewMode(viewModeAtom.set, ViewMode.SANDWICH_VIEW)
  const setCallTree = useSetViewMode(viewModeAtom.set, ViewMode.CALL_TREE)

  if (!props.activeProfileState) return null

  return (
    <Fragment>
      {enableTimelineView && (
        <div
          className={css(style.toolbarTab, props.viewMode === ViewMode.CHRONO_FLAME_CHART && style.toolbarTabActive)}
          onClick={setChronoFlameChart}
          title='Timeline view'
        >
          <span className={css(style.toolbarIcon)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-audio-lines-icon lucide-audio-lines"><path d="M2 10v3" /><path d="M6 6v11" /><path d="M10 3v18" /><path d="M14 8v7" /><path d="M18 5v13" /><path d="M22 10v3" /></svg>
          </span>
        </div>
      )}
      <div
        className={css(style.toolbarTab, props.viewMode === ViewMode.LEFT_HEAVY_FLAME_GRAPH && style.toolbarTabActive)}
        onClick={setLeftHeavyFlameGraph}
        title='Flamegraph view'
      >
        <span className={css(style.toolbarIcon)} >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flame-icon lucide-flame"><path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" /></svg>
        </span>
      </div>
      <div className={css(style.toolbarTab, props.viewMode === ViewMode.SANDWICH_VIEW && style.toolbarTabActive)}
        onClick={setSandwichView}
        title='Sandwich view'>
        <span className={css(style.toolbarIcon)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sandwich-icon lucide-sandwich"><path d="m2.37 11.223 8.372-6.777a2 2 0 0 1 2.516 0l8.371 6.777" /><path d="M21 15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5.25" /><path d="M3 15a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h9" /><path d="m6.67 15 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2" /><rect width="20" height="4" x="2" y="11" rx="1" /></svg>
        </span>
      </div>
      <div className={css(style.toolbarTab, props.viewMode === ViewMode.CALL_TREE && style.toolbarTabActive)}
        onClick={setCallTree} title='Call tree' aria-label='Call tree'>
        <span className={css(style.toolbarIcon)}>
          <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-list-tree'><path d='M8 5h13'/><path d='M13 12h8'/><path d='M13 19h8'/><path d='M3 10a2 2 0 0 0 2 2h3'/><path d='M3 5v12a2 2 0 0 0 2 2h3'/></svg>
        </span>
      </div>
    </Fragment>
  )
}

const getCachedProfileList = (() => {
  // TODO(jlfwong): It would be nice to just implement this as useMemo, but if
  // we do that using profileGroup or profileGroup.profiles as the cache key,
  // then it will invalidate whenever *anything* changes, because
  // profileGroup.profiles is ProfileState[], which contains component state
  // information for each tab for each profile. So whenever any property in any
  // persisted view state changes for *any* view in *any* profile, the profiles
  // list will get re-generated.
  let cachedProfileList: Profile[] | null = null

  return (profileGroup: ProfileGroupState): Profile[] | null => {
    let nextProfileList = profileGroup?.profiles.map(p => p.profile) || null

    if (cachedProfileList === null || (nextProfileList != null && !objectsHaveShallowEquality(cachedProfileList, nextProfileList))) {
      cachedProfileList = nextProfileList
    }

    return cachedProfileList
  }
})()

function ToolbarCenterContent(props: ToolbarProps): JSX.Element {
  const style = getStyle(useTheme())

  const { activeProfileState, profileGroup } = props
  const profiles = getCachedProfileList(profileGroup)
  const [profileSelectShown, setProfileSelectShown] = useState(false)

  const openProfileSelect = useCallback(() => {
    setProfileSelectShown(true)
  }, [setProfileSelectShown])

  const closeProfileSelect = useCallback(() => {
    setProfileSelectShown(false)
  }, [setProfileSelectShown])

  useEffect(() => {
    const onWindowKeyPress = (ev: KeyboardEvent) => {
      if (ev.key === 't') {
        ev.preventDefault()
        setProfileSelectShown(true)
      }
    }
    window.addEventListener('keypress', onWindowKeyPress)
    return () => {
      window.removeEventListener('keypress', onWindowKeyPress)
    }
  }, [setProfileSelectShown])

  useEffect(() => {
    const onWindowKeyPress = (ev: KeyboardEvent) => {
      if (ev.key === 't') {
        ev.preventDefault()
        setProfileSelectShown(true)
      }
    }
    window.addEventListener('keypress', onWindowKeyPress)
    return () => {
      window.removeEventListener('keypress', onWindowKeyPress)
    }
  }, [setProfileSelectShown])

  if (activeProfileState && profileGroup && profiles) {
    const profile = activeProfileState.profile
    const profileName = profile.displayName
    const title = profileGroup.name === profile.name ? profileName : `${profileGroup.name} | ${profileName}`
    const totalNonIdleWeight = profile.formatValue(profile.getTotalNonIdleWeight())
    const profileSummary = (
      <Fragment>
        {title}{' '}
        <span className={css(style.toolbarProfileWeight)}>{totalNonIdleWeight}</span>
      </Fragment>
    )
    const content =
      profileGroup.profiles.length === 1 ? (
        profileSummary
      ) : (
        <span onMouseOver={openProfileSelect}>
          {profileSummary}{' '}
          <span className={css(style.toolbarProfileIndex)}>
            ({activeProfileState.index + 1}/{profileGroup.profiles.length})
          </span>
        </span>
      )

    return (
      <div className={css(style.toolbarCenterHoverArea)} onMouseLeave={closeProfileSelect}>
        <div className={css(style.toolbarCenterText)}>{content}</div>
        {profileGroup.profiles.length > 1 && (
          <div style={{ display: profileSelectShown ? 'block' : 'none' }}>
            <ProfileSelect
              setProfileIndexToView={props.setProfileIndexToView}
              indexToView={profileGroup.indexToView}
              profiles={profiles}
              closeProfileSelect={closeProfileSelect}
              visible={profileSelectShown}
            />
          </div>
        )}
      </div>
    )
  }
  return (
    <div className={css(style.toolbarCenterText)}>Picolloscope</div>
  )
}

function ShortcutsPopup({ close }: { close(): void }) {
  const style = getStyle(useTheme())

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close])

  return (
    <div className={css(style.shortcutsOverlay)} onClick={close}>
      <div className={css(style.shortcutsPopup)} onClick={ev => ev.stopPropagation()}>
        <div className={css(style.shortcutsHeader)}>
          <div className={css(style.shortcutsTitle)}>Info</div>
          <button className={css(style.shortcutsClose)} onClick={close}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className={css(style.shortcutsList)}>
          {keyboardShortcuts.map(({ keys, action }) => (
            <div className={css(style.shortcutsRow)} key={keys}>
              <div className={css(style.shortcutsKeys)}>{keys}</div>
              <div className={css(style.shortcutsAction)}>{action}</div>
            </div>
          ))}
        </div>
        <div className={css(style.shortcutsFooter)}>
          {licenseLinks.map(({ href, label }) => (
            <a className={css(style.shortcutsLink)} href={href} target="_blank" rel="noopener noreferrer" key={href}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function ToolbarRightContent(props: ToolbarProps & { openShortcuts(): void }) {
  const style = getStyle(useTheme())
  const colorScheme = useAtom(colorSchemeAtom)
  const embedded = props.urlParams.embedded === true

  const importFile = (
    <div className={css(style.toolbarTab)} onClick={props.browseForFile} title='Open file'>
      <span className={css(style.toolbarIcon)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-open-icon lucide-folder-open"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" /></svg>
      </span>
    </div>
  )

  const colorSchemeToggle = (
    <div className={css(style.toolbarTab)} onClick={colorSchemeAtom.cycleToNextColorScheme} title='Change color theme'>
      <span className={css(style.toolbarIcon)} dangerouslySetInnerHTML={{ __html: colorSchemeToSvg(colorScheme) }} />
    </div>
  )

  const help = (
    <div className={css(style.toolbarTab)} onClick={props.openShortcuts} title='Show info'>
      <span className={css(style.toolbarIcon)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info-icon lucide-info"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
      </span>
    </div>
  )

  return (
    <Fragment>
      {!embedded && importFile}
      {!embedded && colorSchemeToggle}
      {help}
      {embedded && <span className={css(style.toolbarExternalButtonSpacer)} />}
    </Fragment>
  )
}

export function Toolbar(props: ToolbarProps) {
  const style = getStyle(useTheme())
  const [shortcutsShown, setShortcutsShown] = useState(false)
  const [sideWidth, setSideWidth] = useState(0)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const openShortcuts = useCallback(() => setShortcutsShown(true), [setShortcutsShown])
  const closeShortcuts = useCallback(() => setShortcutsShown(false), [setShortcutsShown])

  useLayoutEffect(() => {
    const measure = () => {
      const toolbarWidth = toolbarRef.current?.getBoundingClientRect().width || 0
      const leftWidth = leftRef.current?.getBoundingClientRect().width || 0
      const rightWidth = rightRef.current?.getBoundingClientRect().width || 0
      setSideWidth(Math.min(Math.max(leftWidth, rightWidth) + 8, toolbarWidth / 2))
    }

    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
    }
  }, [props.activeProfileState, props.urlParams.embedded])

  return (
    <div className={css(style.toolbar)} ref={toolbarRef}>
      <div className={css(style.toolbarLeft)} ref={leftRef}>
        <ToolbarLeftContent {...props} />
      </div>
      <div className={css(style.toolbarCenter)} style={{left: sideWidth, right: sideWidth}}>
        <ToolbarCenterContent {...props} />
      </div>
      <div className={css(style.toolbarRight)} ref={rightRef}>
        <ToolbarRightContent {...props} openShortcuts={openShortcuts} />
      </div>
      {shortcutsShown && <ShortcutsPopup close={closeShortcuts} />}
    </div>
  )
}

const getStyle = withTheme(theme =>
  StyleSheet.create({
    toolbar: {
      height: Sizes.TOOLBAR_HEIGHT,
      flexShrink: 0,
      background: theme.altBgPrimaryColor,
      color: theme.altFgPrimaryColor,
      textAlign: 'center',
      fontFamily: FontFamily.MONOSPACE,
      fontSize: FontSize.TITLE,
      lineHeight: `${Sizes.TOOLBAR_TAB_HEIGHT}px`,
      userSelect: 'none',
    },
    toolbarLeft: {
      position: 'absolute',
      height: Sizes.TOOLBAR_HEIGHT,
      overflow: 'hidden',
      top: 0,
      left: 0,
      textAlign: 'left',
    },
    toolbarCenter: {
      position: 'absolute',
      top: 0,
      height: Sizes.TOOLBAR_HEIGHT,
      overflow: 'visible',
      pointerEvents: 'none',
    },
    toolbarCenterText: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      pointerEvents: 'auto',
      lineHeight: `${Sizes.TOOLBAR_HEIGHT}px`,
      userSelect: 'text',
    },
    toolbarCenterHoverArea: {
      height: Sizes.TOOLBAR_HEIGHT,
      overflow: 'visible',
      pointerEvents: 'auto',
    },
    toolbarRight: {
      height: Sizes.TOOLBAR_HEIGHT,
      overflow: 'hidden',
      position: 'absolute',
      top: 0,
      right: 0,
      textAlign: 'right',
    },
    toolbarProfileIndex: {
      color: theme.altFgSecondaryColor,
    },
    toolbarProfileWeight: {
      color: theme.altFgSecondaryColor,
      fontFamily: 'monospace',
    },
    toolbarTab: {
      background: 'transparent',
      marginTop: 0,
      height: Sizes.TOOLBAR_HEIGHT,
      lineHeight: `${Sizes.TOOLBAR_HEIGHT}px`,
      paddingLeft: 5,
      paddingRight: 5,
      display: 'inline-flex',
      alignItems: 'center',
      marginLeft: 0,
      transition: `all ${Duration.HOVER_CHANGE} ease-in`,
      ':hover': {
        background: '#555555',
      },
    },
    toolbarTabActive: {
      background: theme.selectionPrimaryColor,
      ':hover': {
        background: theme.selectionPrimaryColor,
      },
    },
    toolbarIcon: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      border: 0,
      padding: 1,
      verticalAlign: 'middle',
      transition: `all ${Duration.HOVER_CHANGE} ease-in`,
    },
    toolbarExternalButtonSpacer: {
      display: 'inline-block',
      width: 20,
      height: Sizes.TOOLBAR_HEIGHT,
      verticalAlign: 'top',
    },
    shortcutsPopup: {
      position: 'fixed',
      top: Sizes.TOOLBAR_HEIGHT + 5,
      right: 5,
      boxSizing: 'border-box',
      width: 520,
      maxWidth: 'calc(100vw - 12px)',
      maxHeight: 'calc(100vh - 32px)',
      overflow: 'auto',
      padding: 0,
      background: theme.bgPrimaryColor,
      color: theme.fgPrimaryColor,
      border: `1px solid ${theme.altBgSecondaryColor}`,
      boxShadow: '0 4px 18px rgba(0, 0, 0, 0.35)',
      textAlign: 'left',
      lineHeight: '18px',
      userSelect: 'text',
    },
    shortcutsOverlay: {
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: ZIndex.SHORTCUTS,
    },
    shortcutsHeader: {
      position: 'relative',
      height: Sizes.TOOLBAR_HEIGHT,
      background: theme.altBgPrimaryColor,
      color: theme.altFgPrimaryColor,
      fontSize: FontSize.TITLE,
      lineHeight: `${Sizes.TOOLBAR_HEIGHT}px`,
    },
    shortcutsTitle: {
      position: 'absolute',
      top: 0,
      left: 20,
      right: 20,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      textAlign: 'center',
    },
    shortcutsClose: {
      position: 'absolute',
      top: 0,
      right: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      border: 0,
      padding: 1,
      margin: 0,
      background: 'transparent',
      color: theme.altFgPrimaryColor,
      font: 'inherit',
      cursor: 'pointer',
      ':hover': {
        background: '#555555',
      },
    },
    shortcutsList: {
      display: 'grid',
      gridTemplateColumns: 'max-content 1fr',
      columnGap: '16px',
      rowGap: '4px',
      padding: 12,
    },
    shortcutsRow: {
      display: 'contents',
    },
    shortcutsKeys: {
      color: theme.fgPrimaryColor,
      whiteSpace: 'nowrap',
    },
    shortcutsAction: {
      color: theme.fgSecondaryColor,
    },
    shortcutsFooter: {
      display: 'flex',
      gap: '12px',
      marginTop: 10,
      padding: '8px 12px 12px',
      borderTop: `1px solid ${theme.altBgSecondaryColor}`,
      fontSize: FontSize.LABEL,
      lineHeight: '14px',
    },
    shortcutsLink: {
      color: theme.selectionPrimaryColor,
      textDecoration: 'none',
      ':hover': {
        color: theme.selectionSecondaryColor,
      },
    },
  }),
)
