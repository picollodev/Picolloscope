import {ProfileFrame} from '../lib/profile'
import {StyleSheet, css} from 'aphrodite'
import {ProfileTableViewContainer} from './profile-table-view'
import {h, JSX, createContext} from 'preact'
import {memo} from 'preact/compat'
import {useCallback, useContext} from 'preact/hooks'
import {commonStyle, Sizes, FontSize} from './style'
import {InvertedCallerFlamegraphView} from './inverted-caller-flamegraph-view'
import {CalleeFlamegraphView} from './callee-flamegraph-view'
import {SandwichSearchView} from './sandwich-search-view'
import {ActiveProfileState} from '../app-state/active-profile-state'
import {useProfileTableData} from './profile-table-data'
import {ProfileSearchContext} from './search-view'
import {Theme, useTheme, withTheme} from './themes/theme'
import {metadataFormattingAtom, profileGroupAtom, tableSortMethodAtom} from '../app-state'
import {useAtom} from '../lib/atom'
import {StatelessComponent} from '../lib/preact-helpers'

interface SandwichViewProps {
  selectedFrame: ProfileFrame | null
  profileIndex: number
  theme: Theme
  activeProfileState: ActiveProfileState
  setSelectedFrame: (selectedFrame: ProfileFrame | null) => void
  glCanvas: HTMLCanvasElement
}

class SandwichView extends StatelessComponent<SandwichViewProps> {
  private setSelectedFrame = (selectedFrame: ProfileFrame | null) => {
    this.props.setSelectedFrame(selectedFrame)
  }

  onWindowKeyPress = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      this.setSelectedFrame(null)
    }
  }

  componentDidMount() {
    window.addEventListener('keydown', this.onWindowKeyPress)
  }
  componentWillUnmount() {
    window.removeEventListener('keydown', this.onWindowKeyPress)
  }

  render() {
    const style = getStyle(this.props.theme)

    const {selectedFrame} = this.props
    let flamegraphViews: JSX.Element | null = null

    if (selectedFrame) {
      flamegraphViews = (
        <div className={css(commonStyle.fillY, style.callersAndCallees, commonStyle.vbox)}>
          <div className={css(commonStyle.hbox, style.panZoomViewWraper)}>
            <div className={css(style.flamechartLabelParent)}>
              <div className={css(style.flamechartLabel)}>Callers</div>
            </div>
            <InvertedCallerFlamegraphView glCanvas={this.props.glCanvas} activeProfileState={this.props.activeProfileState} />
          </div>
          <div className={css(style.divider)} />
          <div className={css(commonStyle.hbox, style.panZoomViewWraper)}>
            <div className={css(style.flamechartLabelParent, style.flamechartLabelParentBottom)}>
              <div className={css(style.flamechartLabel, style.flamechartLabelBottom)}>Callees</div>
            </div>
            <CalleeFlamegraphView glCanvas={this.props.glCanvas} activeProfileState={this.props.activeProfileState} />
          </div>
        </div>
      )
    }

    return (
      <div className={css(commonStyle.hbox, commonStyle.fillY)}>
        <div className={css(style.tableView)}>
          <ProfileTableViewContainer activeProfileState={this.props.activeProfileState} />
          <SandwichSearchView />
        </div>
        {flamegraphViews}
      </div>
    )
  }
}

const getStyle = withTheme(theme =>
  StyleSheet.create({
    tableView: {
      position: 'relative',
      flex: 1,
    },
    panZoomViewWraper: {
      flex: 1,
    },
    flamechartLabelParent: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      fontSize: FontSize.TITLE,
      width: FontSize.TITLE * 1.2,
      borderRight: `1px solid ${theme.fgSecondaryColor}`,
    },
    flamechartLabelParentBottom: {
      justifyContent: 'flex-start',
    },
    flamechartLabel: {
      transform: 'rotate(-90deg)',
      transformOrigin: '50% 50% 0',
      width: FontSize.TITLE * 1.2,
      flexShrink: 1,
    },
    flamechartLabelBottom: {
      transform: 'rotate(-90deg)',
      display: 'flex',
      justifyContent: 'flex-end',
    },
    callersAndCallees: {
      flex: 1,
      borderLeft: `${Sizes.SEPARATOR_HEIGHT}px solid ${theme.fgSecondaryColor}`,
    },
    divider: {
      height: 2,
      background: theme.fgSecondaryColor,
    },
  }),
)

interface SandwichViewContainerProps {
  activeProfileState: ActiveProfileState
  glCanvas: HTMLCanvasElement
}

interface SandwichViewContextData {
  rowList: ProfileFrame[]
  selectedFrame: ProfileFrame | null
  setSelectedFrame: (frame: ProfileFrame | null) => void
  getIndexForFrame: (frame: ProfileFrame) => number | null
  getSearchMatchForFrame: (frame: ProfileFrame) => [number, number][] | null
}

export const SandwichViewContext = createContext<SandwichViewContextData | null>(null)

export const SandwichViewContainer = memo((ownProps: SandwichViewContainerProps) => {
  const {activeProfileState, glCanvas} = ownProps
  const {sandwichViewState, index} = activeProfileState
  const {callerCallee} = sandwichViewState

  const theme = useTheme()
  const setSelectedFrame = useCallback((selectedFrame: ProfileFrame | null) => {
    profileGroupAtom.setSelectedFrame(selectedFrame)
  }, [])

  const profile = activeProfileState.profile
  const tableSortMethod = useAtom(tableSortMethodAtom)
  const metadataFormatting = useAtom(metadataFormattingAtom)
  const profileSearchResults = useContext(ProfileSearchContext)

  const selectedFrame = callerCallee ? callerCallee.selectedFrame : null

  const {rowList, getIndexForFrame, getSearchMatchForFrame} = useProfileTableData(profile, tableSortMethod, metadataFormatting, profileSearchResults)

  const contextData: SandwichViewContextData = {
    rowList,
    selectedFrame,
    setSelectedFrame,
    getIndexForFrame,
    getSearchMatchForFrame,
  }

  return (
    <SandwichViewContext.Provider value={contextData}>
      <SandwichView
        theme={theme}
        activeProfileState={activeProfileState}
        glCanvas={glCanvas}
        setSelectedFrame={setSelectedFrame}
        selectedFrame={selectedFrame}
        profileIndex={index}
      />
    </SandwichViewContext.Provider>
  )
})
