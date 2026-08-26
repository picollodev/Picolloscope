import {h, JSX, ComponentChild} from 'preact'
import {StyleSheet, css} from 'aphrodite'
import {Profile, ProfileFrame} from '../lib/profile'
import {formatPercent} from '../lib/utils'
import {FontSize, Sizes, commonStyle} from './style'
import {ColorChit} from './color-chit'
import {ListItem, ScrollableListView} from './scrollable-list-view'
import {createGetCSSColorForFrame, getFrameToColorBucket} from '../app-state/getters'
import {memo} from 'preact/compat'
import {useCallback, useMemo, useContext, useRef, useState} from 'preact/hooks'
import {SandwichViewContext} from './sandwich-view'
import {Color} from '../lib/color'
import {useTheme, withTheme} from './themes/theme'
import {
  SortDirection,
  SortMethod,
  SortField,
  profileGroupAtom,
  tableSortMethodAtom,
  searchIsActiveAtom,
  searchQueryAtom,
  metadataFormattingAtom,
} from '../app-state'
import {useAtom} from '../lib/atom'
import {ActiveProfileState} from '../app-state/active-profile-state'
import {Hovertip} from './hovertip'
import {Vec2} from '../lib/math'

interface HBarProps {
  perc: number
}

function HBarDisplay(props: HBarProps) {
  const style = getStyle(useTheme())

  return (
    <div className={css(style.hBarDisplay)}>
      <div className={css(style.hBarDisplayFilled)} style={{width: `${props.perc}%`}} />
    </div>
  )
}

interface SortIconProps {
  activeDirection: SortDirection | null
}

function SortIcon(props: SortIconProps) {
  const theme = useTheme()
  const style = getStyle(theme)

  const {activeDirection} = props
  const upFill = activeDirection === SortDirection.ASCENDING ? theme.fgPrimaryColor : theme.fgSecondaryColor
  const downFill = activeDirection === SortDirection.DESCENDING ? theme.fgPrimaryColor : theme.fgSecondaryColor

  return (
    <svg width="8" height="10" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg" className={css(style.sortIcon)}>
      <path d="M0 4L4 0L8 4H0Z" fill={upFill} />
      <path d="M0 4L4 0L8 4H0Z" transform="translate(0 10) scale(1 -1)" fill={downFill} />
    </svg>
  )
}

interface ProfileTableRowViewProps {
  frame: ProfileFrame
  matchedRanges: [number, number][] | null
  index: number
  profile: Profile
  selectedFrame: ProfileFrame | null
  setSelectedFrame: (f: ProfileFrame) => void
  getCSSColorForFrame: (frame: ProfileFrame) => string
  getDisplayName: (frame: ProfileFrame) => string
  setHoveredFrame: (frame: ProfileFrame, event: MouseEvent) => void
  clearHoveredFrame: () => void
}

function formatWeightChange(frame: ProfileFrame, weight: number, baseWeight: number): string {
  if (frame.comparisonStatus === 'new') return ' new'
  if (frame.comparisonStatus === 'out') return ' out'

  if (baseWeight === 0) {
    if (weight === 0) return ' 0.0%'
    return weight > 0 ? '+>10k%' : '-100%'
  }

  const percentDelta = (100 * (weight - baseWeight)) / baseWeight
  if (Math.abs(percentDelta) < 0.05) return ' 0.0%'
  if (percentDelta >= 10000) return '+>10k%'
  if (percentDelta >= 1000) return `+${(percentDelta / 1000).toFixed(1)}k%`
  if (Math.abs(percentDelta) >= 100) return `${percentDelta > 0 ? '+' : ''}${percentDelta.toFixed(0)}%`
  return `${percentDelta > 0 ? '+' : ''}${percentDelta.toFixed(1)}%`
}

function highlightRanges(text: string, ranges: [number, number][], highlightedClassName: string): JSX.Element {
  const spans: ComponentChild[] = []
  let last = 0
  for (let range of ranges) {
    spans.push(text.slice(last, range[0]))
    spans.push(<span className={highlightedClassName}>{text.slice(range[0], range[1])}</span>)
    last = range[1]
  }
  spans.push(text.slice(last))

  return <span>{spans}</span>
}

const ProfileTableRowView = ({
  frame,
  matchedRanges,
  profile,
  index,
  selectedFrame,
  setSelectedFrame,
  getCSSColorForFrame,
  getDisplayName,
  setHoveredFrame,
  clearHoveredFrame,
}: ProfileTableRowViewProps) => {
  const style = getStyle(useTheme())

  const totalWeight = frame.totalWeight
  const selfWeight = frame.selfWeight
  const totalNonIdleWeight = profile.getTotalNonIdleWeight()
  const totalPerc = (100.0 * totalWeight) / totalNonIdleWeight
  const selfPerc = (100.0 * selfWeight) / totalNonIdleWeight
  const totalBasisPointDelta = profile.hasBaseProfile
    ? profile.getWeightShareBasisPointDelta(totalWeight, frame.baseTotalWeight!)
    : 0
  const selfBasisPointDelta = profile.hasBaseProfile
    ? profile.getWeightShareBasisPointDelta(selfWeight, frame.baseSelfWeight!)
    : 0

  const selected = frame === selectedFrame

  // We intentionally use index rather than frame.key here as the tr key
  // in order to re-use rows when sorting rather than creating all new elements.
  return (
    <tr
      key={`${index}`}
      onClick={setSelectedFrame.bind(null, frame)}
      onMouseMove={event => setHoveredFrame(frame, event)}
      onMouseLeave={clearHoveredFrame}
      className={css(style.tableRow, index % 2 == 0 && style.tableRowEven, selected && style.tableRowSelected)}
    >
      <td className={css(style.numericCell)}>
        {profile.formatValue(totalWeight)} <span className={css(style.percentText)}>{formatPercent(totalPerc)}</span>
        <HBarDisplay perc={totalPerc} />
      </td>
      {profile.hasBaseProfile && (
        <td className={css(style.numericCell, style.deltaCell)}>
          <span className={css(style.deltaValue)}>{profile.formatValue(frame.totalWeightDelta!)}</span>{'|'}
          <span className={css(style.relativeDelta)}>{formatWeightChange(frame, totalWeight, frame.baseTotalWeight!)}</span>{' '}
          <span className={css(style.basisPointDelta)}>{totalBasisPointDelta} bp</span>
        </td>
      )}
      <td className={css(style.numericCell)}>
        {profile.formatValue(selfWeight)} <span className={css(style.percentText)}>{formatPercent(selfPerc)}</span>
        <HBarDisplay perc={selfPerc} />
      </td>
      {profile.hasBaseProfile && (
        <td className={css(style.numericCell, style.deltaCell)}>
          <span className={css(style.deltaValue)}>{profile.formatValue(frame.selfWeightDelta!)}</span>{'|'}
          <span className={css(style.relativeDelta)}>{formatWeightChange(frame, selfWeight, frame.baseSelfWeight!)}</span>{' '}
          <span className={css(style.basisPointDelta)}>{selfBasisPointDelta} bp</span>
        </td>
      )}
      <td className={css(style.textCell)}>
        <ColorChit color={getCSSColorForFrame(frame)} />
        {matchedRanges
          ? highlightRanges(getDisplayName(frame), matchedRanges, css(style.matched, selected && style.matchedSelected))
          : getDisplayName(frame)}
      </td>
    </tr>
  )
}

interface ProfileTableViewProps {
  profile: Profile
  selectedFrame: ProfileFrame | null
  getCSSColorForFrame: (frame: ProfileFrame) => string
  sortMethod: SortMethod
  setSelectedFrame: (frame: ProfileFrame | null) => void
  setSortMethod: (sortMethod: SortMethod) => void
  searchQuery: string
  searchIsActive: boolean
}

export const ProfileTableView = memo(
  ({
    profile,
    sortMethod,
    setSortMethod,
    selectedFrame,
    setSelectedFrame,
    getCSSColorForFrame,
    searchQuery,
    searchIsActive,
  }: ProfileTableViewProps) => {
    const style = getStyle(useTheme())
    const metadataFormatting = useAtom(metadataFormattingAtom)
    const getDisplayName = useCallback(
      (frame: ProfileFrame) => frame.getDisplayName(metadataFormatting),
      [metadataFormatting],
    )
    const container = useRef<HTMLDivElement | null>(null)
    const [hoveredFrame, setHoveredFrameState] = useState<{frame: ProfileFrame; event: MouseEvent} | null>(null)

    const setHoveredFrame = useCallback((frame: ProfileFrame, event: MouseEvent) => {
      setHoveredFrameState({frame, event})
    }, [])
    const clearHoveredFrame = useCallback(() => setHoveredFrameState(null), [])

    const onSortClick = useCallback(
      (field: SortField, ev: MouseEvent) => {
        ev.preventDefault()

        if (sortMethod.field == field) {
          // Toggle
          setSortMethod({
            field,
            direction: sortMethod.direction === SortDirection.ASCENDING ? SortDirection.DESCENDING : SortDirection.ASCENDING,
          })
        } else {
          // Set a sane default
          switch (field) {
            case SortField.SYMBOL_NAME: {
              setSortMethod({field, direction: SortDirection.ASCENDING})
              break
            }
            case SortField.SELF: {
              setSortMethod({field, direction: SortDirection.DESCENDING})
              break
            }
            case SortField.TOTAL: {
              setSortMethod({field, direction: SortDirection.DESCENDING})
              break
            }
            case SortField.SELF_DELTA:
            case SortField.TOTAL_DELTA: {
              setSortMethod({field, direction: SortDirection.DESCENDING})
              break
            }
          }
        }
      },
      [sortMethod, setSortMethod],
    )

    const sandwichContext = useContext(SandwichViewContext)

    const renderItems = useCallback(
      (firstIndex: number, lastIndex: number) => {
        if (!sandwichContext) return null

        const rows: JSX.Element[] = []

        for (let i = firstIndex; i <= lastIndex; i++) {
          const frame = sandwichContext.rowList[i]
          const match = sandwichContext.getSearchMatchForFrame(frame)
          rows.push(
            ProfileTableRowView({
              frame,
              matchedRanges: match == null ? null : match,
              index: i,
              profile: profile,
              selectedFrame: selectedFrame,
              setSelectedFrame: setSelectedFrame,
              getCSSColorForFrame: getCSSColorForFrame,
              getDisplayName,
              setHoveredFrame,
              clearHoveredFrame,
            }),
          )
        }

        if (rows.length === 0) {
          if (searchIsActive) {
            rows.push(
              <tr>
                <td className={css(style.emptyState)}>No symbol names match query "{searchQuery}".</td>
              </tr>,
            )
          } else {
            rows.push(
              <tr>
                <td className={css(style.emptyState)}>No symbols found.</td>
              </tr>,
            )
          }
        }

        return <table className={css(style.tableView)}>{rows}</table>
      },
      [
        sandwichContext,
        profile,
        selectedFrame,
        setSelectedFrame,
        getCSSColorForFrame,
        getDisplayName,
        setHoveredFrame,
        clearHoveredFrame,
        searchIsActive,
        searchQuery,
        style.emptyState,
        style.tableView,
      ],
    )

    const listItems: ListItem[] = useMemo(
      () => (sandwichContext == null ? [] : sandwichContext.rowList.map(f => ({size: Sizes.FRAME_HEIGHT}))),
      [sandwichContext],
    )

    const onTotalClick = useCallback((ev: MouseEvent) => onSortClick(SortField.TOTAL, ev), [onSortClick])
    const onTotalDeltaClick = useCallback((ev: MouseEvent) => onSortClick(SortField.TOTAL_DELTA, ev), [onSortClick])
    const onSelfClick = useCallback((ev: MouseEvent) => onSortClick(SortField.SELF, ev), [onSortClick])
    const onSelfDeltaClick = useCallback((ev: MouseEvent) => onSortClick(SortField.SELF_DELTA, ev), [onSortClick])
    const onSymbolNameClick = useCallback((ev: MouseEvent) => onSortClick(SortField.SYMBOL_NAME, ev), [onSortClick])

    return (
      <div className={css(commonStyle.vbox, style.profileTableView)} ref={container}>
        <table className={css(style.tableView)}>
          <thead className={css(style.tableHeader)}>
            <tr>
              <th className={css(style.numericHeader)} onClick={onTotalClick}>
                <SortIcon activeDirection={sortMethod.field === SortField.TOTAL ? sortMethod.direction : null} />
                Total
              </th>
              {profile.hasBaseProfile && (
                <th className={css(style.numericHeader, style.deltaCell)} onClick={onTotalDeltaClick}>
                  <SortIcon activeDirection={sortMethod.field === SortField.TOTAL_DELTA ? sortMethod.direction : null} />
                  Δ Total
                </th>
              )}
              <th className={css(style.numericHeader)} onClick={onSelfClick}>
                <SortIcon activeDirection={sortMethod.field === SortField.SELF ? sortMethod.direction : null} />
                Self
              </th>
              {profile.hasBaseProfile && (
                <th className={css(style.numericHeader, style.deltaCell)} onClick={onSelfDeltaClick}>
                  <SortIcon activeDirection={sortMethod.field === SortField.SELF_DELTA ? sortMethod.direction : null} />
                  Δ Self
                </th>
              )}
              <th className={css(style.textCell)} onClick={onSymbolNameClick}>
                <SortIcon activeDirection={sortMethod.field === SortField.SYMBOL_NAME ? sortMethod.direction : null} />
                Symbol Name
              </th>
            </tr>
          </thead>
        </table>
        <ScrollableListView
          axis={'y'}
          items={listItems}
          className={css(style.scrollView)}
          renderItems={renderItems}
          initialIndexInView={selectedFrame == null ? null : sandwichContext?.getIndexForFrame(selectedFrame)}
        />
        {container.current != null && (
          <Hovertip
            containerSize={new Vec2(container.current.clientWidth, container.current.clientHeight)}
            offset={
              hoveredFrame == null
                ? null
                : new Vec2(
                    hoveredFrame.event.clientX - container.current.getBoundingClientRect().left,
                    hoveredFrame.event.clientY - container.current.getBoundingClientRect().top,
                  )
            }
            frame={hoveredFrame?.frame ?? null}
            formatValue={profile.formatValue.bind(profile)}
            totalWeight={profile.getTotalNonIdleWeight()}
          />
        )}
      </div>
    )
  },
)

const getStyle = withTheme(theme =>
  StyleSheet.create({
    profileTableView: {
      background: theme.bgPrimaryColor,
      height: '100%',
      position: 'relative',
    },
    scrollView: {
      overflowY: 'auto',
      overflowX: 'hidden',
      flexGrow: 1,
      '::-webkit-scrollbar': {
        background: theme.bgPrimaryColor,
      },
      '::-webkit-scrollbar-thumb': {
        background: theme.fgSecondaryColor,
        borderRadius: 20,
        border: `3px solid ${theme.bgPrimaryColor}`,
        ':hover': {
          background: theme.fgPrimaryColor,
        },
      },
    },
    tableView: {
      width: '100%',
      fontSize: FontSize.LABEL,
      background: theme.bgPrimaryColor,
    },
    tableHeader: {
      borderBottom: `2px solid ${theme.bgSecondaryColor}`,
      textAlign: 'center',
      color: theme.fgPrimaryColor,
      userSelect: 'none',
    },
    sortIcon: {
      position: 'relative',
      top: 1,
      marginRight: Sizes.FRAME_HEIGHT / 4,
    },
    tableRow: {
      background: theme.bgPrimaryColor,
      height: Sizes.FRAME_HEIGHT,
    },
    tableRowEven: {
      background: theme.bgSecondaryColor,
    },
    tableRowSelected: {
      background: theme.selectionPrimaryColor,
      color: theme.altFgPrimaryColor,
    },
    numericHeader: {
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      position: 'relative',
      textAlign: 'center',
      paddingRight: Sizes.FRAME_HEIGHT / 2,
      width: 5 * Sizes.FRAME_HEIGHT,
      minWidth: 5 * Sizes.FRAME_HEIGHT,
    },
    numericCell: {
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      position: 'relative',
      textAlign: 'right',
      paddingRight: Sizes.FRAME_HEIGHT / 2,
      width: 5 * Sizes.FRAME_HEIGHT,
      minWidth: 5 * Sizes.FRAME_HEIGHT,
    },
    deltaCell: {
      width: '23ch',
      minWidth: '23ch',
    },
    deltaValue: {
      display: 'inline-block',
      width: '8ch',
      textAlign: 'right',
    },
    relativeDelta: {
      display: 'inline-block',
      width: '6ch',
      textAlign: 'left',
    },
    basisPointDelta: {
      display: 'inline-block',
      width: '6ch',
      textAlign: 'right',
    },
    percentText: {
      display: 'inline-block',
      minWidth: '6ch',
      textAlign: 'right',
    },
    textCell: {
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      width: '100%',
      maxWidth: 0,
    },
    hBarDisplay: {
      position: 'absolute',
      background: Color.fromCSSHex(theme.weightColor).withAlpha(0.2).toCSS(),
      bottom: 2,
      height: 2,
      width: `calc(100% - ${Sizes.FRAME_HEIGHT}px)`,
      right: Sizes.FRAME_HEIGHT / 2,
    },
    hBarDisplayFilled: {
      height: '100%',
      position: 'absolute',
      background: theme.weightColor,
      right: 0,
    },
    matched: {
      borderBottom: `2px solid ${theme.fgPrimaryColor}`,
    },
    matchedSelected: {
      borderColor: theme.altFgPrimaryColor,
    },
    emptyState: {
      textAlign: 'center',
      fontWeight: 'bold',
    },
  }),
)

interface ProfileTableViewContainerProps {
  activeProfileState: ActiveProfileState
}

export const ProfileTableViewContainer = memo((ownProps: ProfileTableViewContainerProps) => {
  const {activeProfileState} = ownProps
  const {profile, sandwichViewState} = activeProfileState
  if (!profile) throw new Error('profile missing')
  const tableSortMethod = useAtom(tableSortMethodAtom)
  const theme = useTheme()
  const {callerCallee} = sandwichViewState
  const selectedFrame = callerCallee ? callerCallee.selectedFrame : null
  const frameToColorBucket = getFrameToColorBucket(profile)
  const getCSSColorForFrame = createGetCSSColorForFrame({theme, frameToColorBucket})

  const setSelectedFrame = useCallback((selectedFrame: ProfileFrame | null) => {
    profileGroupAtom.setSelectedFrame(selectedFrame)
  }, [])
  const searchIsActive = useAtom(searchIsActiveAtom)
  const searchQuery = useAtom(searchQueryAtom)

  return (
    <ProfileTableView
      profile={profile}
      selectedFrame={selectedFrame}
      getCSSColorForFrame={getCSSColorForFrame}
      sortMethod={tableSortMethod}
      setSelectedFrame={setSelectedFrame}
      setSortMethod={tableSortMethodAtom.set}
      searchIsActive={searchIsActive}
      searchQuery={searchQuery}
    />
  )
})
