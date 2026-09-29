import {h} from 'preact'
import {useMemo, useRef, useState} from 'preact/hooks'
import {css, StyleSheet} from 'aphrodite'
import {CallTreeNode, Profile, ProfileFrame} from '../lib/profile'
import {metadataFormattingAtom, profileGroupAtom, tableSortMethodAtom, searchIsActiveAtom, searchQueryAtom} from '../app-state'
import {ProfileSearchResults} from '../lib/profile-search'
import {CallTreeViewState} from '../app-state/profile-group'
import {useAtom} from '../lib/atom'
import {Vec2} from '../lib/math'
import {ProfileTotal, ProfileTableView, ProfileTableHeader} from './profile-table-view'
import {useProfileTableData} from './profile-table-data'
import {ColorChit} from './color-chit'
import {createGetCSSColorForFrame, getFrameToColorBucket} from '../app-state/getters'
import {ScrollableListView} from './scrollable-list-view'
import {Hovertip} from './hovertip'
import {FontSize, Sizes} from './style'
import {useTheme, withTheme} from './themes/theme'

interface TreeRow {
  node: CallTreeNode
  profile: Profile
  depth: number
}

// The roots carry their profile's formatting and label; descendants use existing nodes.
function CallTree({roots, state}: {roots: Profile[]; state: CallTreeViewState}) {
  const theme = useTheme()
  const style = getStyle(theme)
  const colors = useMemo(() => new Map(roots.map(profile => [profile,
    createGetCSSColorForFrame({theme, frameToColorBucket: getFrameToColorBucket(profile)}),
  ])), [roots, theme])
  const formatting = useAtom(metadataFormattingAtom)
  const container = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{row: TreeRow; offset: Vec2} | null>(null)
  const hoverProfile = useRef(roots[0])
  if (hover) hoverProfile.current = hover.row.profile
  const total = roots.reduce((sum, profile) => sum + profile.getTotalNonIdleWeight(), 0)
  const isVisible = (weight: number) => total > 0 && Number((100 * weight / total).toFixed(2)) > 0
  const hasVisibleChildren = (node: CallTreeNode) => node.children.some(child => isVisible(child.totalWeight))
  const rows = useMemo(() => {
    const result: TreeRow[] = []
    const pending = roots.map(profile => ({node: profile.groupedCalltreeRoot, profile, depth: 0})).reverse()
    while (pending.length) {
      const row = pending.pop()!
      if (!isVisible(row.depth === 0 ? row.profile.getTotalNonIdleWeight() : row.node.totalWeight)) continue
      result.push(row)
      if (state.expanded.has(row.node)) {
        for (let i = row.node.children.length - 1; i >= 0; i--) {
          pending.push({node: row.node.children[i], profile: row.profile, depth: row.depth + 1})
        }
      }
    }
    return result
  }, [roots, state.expanded, total])
  const items = useMemo(() => rows.map(() => ({size: Sizes.FRAME_HEIGHT})), [rows])
  const selectedIndex = rows.findIndex(row => row.node === state.selected)
  const select = (node: CallTreeNode) => profileGroupAtom.setCallTreeViewState({...state, selected: node})
  const toggle = (node: CallTreeNode) => {
    const expanded = new Set(state.expanded)
    if (expanded.has(node)) expanded.delete(node)
    else expanded.add(node)
    profileGroupAtom.setCallTreeViewState({...state, expanded, selected: node})
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const index = selectedIndex < 0 ? 0 : selectedIndex
    const row = rows[index]
    if (!row) return
    switch (event.key) {
      case 'ArrowDown': select(rows[Math.min(index + 1, rows.length - 1)].node); break
      case 'ArrowUp': select(rows[Math.max(index - 1, 0)].node); break
      case 'Home': select(rows[0].node); break
      case 'End': select(rows[rows.length - 1].node); break
      case 'ArrowRight':
        if (hasVisibleChildren(row.node)) {
          if (!state.expanded.has(row.node)) toggle(row.node)
          else select(rows[index + 1].node)
        }
        break
      case 'ArrowLeft':
        if (state.expanded.has(row.node)) toggle(row.node)
        else if (row.node.parent) select(row.node.parent)
        break
      default: return
    }
    event.preventDefault()
    event.stopPropagation()
  }
  return (
    <div className={css(style.tree)} ref={container} role='tree' aria-label='Call tree' tabIndex={0}
      aria-activedescendant={selectedIndex < 0 ? undefined : `call-tree-row-${selectedIndex}`} onKeyDown={onKeyDown}>
      <ScrollableListView axis='y' items={items} className={css(style.scroll)}
        indexInView={selectedIndex < 0 ? null : selectedIndex}
        renderItems={(first, last) => (
          <div style={{width: 'max-content', minWidth: '100%'}}>
            {rows.slice(first, last + 1).map((row, offset) => {
              const {node, profile, depth} = row
              const expanded = state.expanded.has(node)
              const hasChildren = hasVisibleChildren(node)
              return (
                <div id={`call-tree-row-${first + offset}`} key={first + offset} role='treeitem'
                  aria-level={depth + 1} aria-selected={state.selected === node}
                  aria-expanded={hasChildren ? expanded : undefined}
                  className={css(style.row, (first + offset) % 2 === 0 && style.rowEven, state.selected === node && style.selected)}
                  style={{paddingLeft: depth * Sizes.FRAME_HEIGHT}}
                  onClick={() => {select(node); container.current?.focus({preventScroll: true})}}
                  onMouseMove={event => {
                    const bounds = container.current!.getBoundingClientRect()
                    setHover({row, offset: new Vec2(event.clientX - bounds.left, event.clientY - bounds.top)})
                  }} onMouseLeave={() => setHover(null)}>
                  <button className={css(style.disclosure)} tabIndex={-1} disabled={!hasChildren}
                    aria-label={expanded ? 'Collapse' : 'Expand'}
                    onClick={event => {event.stopPropagation(); toggle(node); container.current?.focus({preventScroll: true})}}>
                    {hasChildren ? expanded ? '▾' : '▸' : ''}
                  </button>
                  <ProfileTotal profile={profile} weight={depth === 0 ? profile.getTotalNonIdleWeight() : node.totalWeight} total={total} />
                  {' '}{depth > 0 && <ColorChit color={colors.get(profile)!(node.frame)} />}
                  {depth === 0 ? profile.displayName : node.frame.getDisplayName(formatting)}
                </div>
              )
            })}
          </div>
        )} />
      {container.current && <Hovertip
        containerSize={new Vec2(container.current.clientWidth, container.current.clientHeight)}
        offset={hover?.offset ?? null} frame={hover && hover.row.depth > 0 ? hover.row.node.frame : null}
        node={hover?.row.node} totalWeight={total}
        formatValue={value => hoverProfile.current.formatValue(value)} />}
    </div>
  )
}

function SubtreeTable({profile, source, total}: {profile: Profile; source: Profile; total: number}) {
  const theme = useTheme()
  const formatting = useAtom(metadataFormattingAtom)
  const sortMethod = useAtom(tableSortMethodAtom)
  const searchQuery = useAtom(searchQueryAtom)
  const searchIsActive = useAtom(searchIsActiveAtom)
  const searchResults = useMemo(() => searchIsActive && searchQuery
    ? new ProfileSearchResults(profile, searchQuery, formatting) : null,
    [profile, searchQuery, searchIsActive, formatting])
  const tableData = useProfileTableData(profile, sortMethod, formatting, searchResults, false)
  const [selection, setSelection] = useState<{profile: Profile; frame: ProfileFrame | null} | null>(null)
  return <ProfileTableView profile={profile} tableData={tableData} totalWeight={total}
    selectedFrame={selection?.profile === profile ? selection.frame : null}
    setSelectedFrame={frame => setSelection({profile, frame})}
    getCSSColorForFrame={createGetCSSColorForFrame({theme, frameToColorBucket: getFrameToColorBucket(source)})}
    sortMethod={sortMethod} setSortMethod={tableSortMethodAtom.set}
    searchQuery={searchQuery} searchIsActive={searchIsActive} />
}

export function CallTreeView({profile}: {profile: Profile}) {
  const group = useAtom(profileGroupAtom)!
  const profiles = useMemo(() => group.profiles.map(entry => entry.profile), [group.profiles])
  const initialState = useMemo<CallTreeViewState>(() => {
    const expanded = new Set(profiles.map(profile => profile.groupedCalltreeRoot))
    const threshold = profile.getTotalNonIdleWeight() * 0.9
    let selected = profile.groupedCalltreeRoot
    // Children are sorted by descending total weight. Only one branch can exceed 90%.
    while (selected.children.length && selected.children[0].totalWeight > threshold) {
      selected = selected.children[0]
      expanded.add(selected)
    }
    return {expanded, selected, allThreads: false}
  }, [profile, profiles])
  const state = group.callTreeViewState ?? initialState
  const roots = useMemo(() => state.allThreads ? profiles : [profile], [state.allThreads, profiles, profile])
  const subtree = useMemo(() => {
    const node = state.selected
    if (!node) return null
    let root = node
    while (root.parent) root = root.parent
    const source = roots.find(profile => profile.groupedCalltreeRoot === root)
    if (!source) return null
    return {source, profile: source.getProfileForSubtrees(node === root ? node.children : [node])}
  }, [roots, state.selected])
  const total = roots.reduce((sum, profile) => sum + profile.getTotalNonIdleWeight(), 0)
  const style = getStyle(useTheme())
  return (
    <div className={css(style.view)}>
      <div className={css(style.panes)}>
        <div className={css(style.treePane)}>
          <ProfileTableHeader>
            <th>
              {profiles.length > 1 && <label className={css(style.controls)}>
                <input className={css(style.checkbox)} type='checkbox' checked={state.allThreads}
                  onChange={event => profileGroupAtom.setCallTreeViewState({...state, allThreads: event.currentTarget.checked})} />
                <span>All threads</span>
              </label>}
            </th>
          </ProfileTableHeader>
          <CallTree roots={roots} state={state} />
        </div>
        {subtree && <div className={css(style.tablePane)}>
          <SubtreeTable profile={subtree.profile} source={subtree.source} total={total} />
        </div>}
      </div>
    </div>
  )
}

const getStyle = withTheme(theme => StyleSheet.create({
  view: {height: '100%', display: 'flex', flexDirection: 'column', color: theme.fgPrimaryColor, background: theme.bgPrimaryColor, fontSize: FontSize.LABEL},
  controls: {display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', gap: 6, whiteSpace: 'nowrap'},
  checkbox: {margin: 0},
  panes: {display: 'flex', flex: 1, minHeight: 0, minWidth: 0},
  treePane: {display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0},
  tablePane: {flex: 1, minWidth: 0, borderLeft: `1px solid ${theme.bgSecondaryColor}`},
  tree: {position: 'relative', flex: 1, minHeight: 0, minWidth: 0},
  scroll: {height: '100%', overflow: 'auto'},
  row: {height: Sizes.FRAME_HEIGHT, lineHeight: `${Sizes.FRAME_HEIGHT}px`, whiteSpace: 'nowrap', boxSizing: 'border-box', paddingRight: 12},
  rowEven: {background: theme.bgSecondaryColor},
  selected: {background: theme.selectionPrimaryColor, color: theme.altFgPrimaryColor},
  disclosure: {display: 'inline-block', verticalAlign: 'top', lineHeight: `${Sizes.FRAME_HEIGHT}px`, width: Sizes.FRAME_HEIGHT, height: Sizes.FRAME_HEIGHT, padding: 0, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer'},
}))
