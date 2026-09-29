import {ViewMode} from '../lib/view-mode'

export type URLTheme = 'system' | 'dark' | 'light'

export interface SourceLinkRule {
  namespacePrefix: string
  urlTemplate: string
}

export interface URLParams {
  profileURL?: string
  baseProfileURL?: string
  title?: string
  localProfilePath?: string
  viewMode?: ViewMode
  embedded?: boolean
  trimUnknownLeafs?: boolean
  trimUnknownRoots?: boolean
  theme?: URLTheme
  sourceLinks?: SourceLinkRule[]
}

function getViewMode(value: string): ViewMode | null {
  switch (value) {
    case 'time-ordered':
      return ViewMode.CHRONO_FLAME_CHART
    case 'left-heavy':
      return ViewMode.LEFT_HEAVY_FLAME_GRAPH
    case 'sandwich':
      return ViewMode.SANDWICH_VIEW
    case 'call-tree':
      return ViewMode.CALL_TREE
    default:
      return null
  }
}

function getTheme(value: string): URLTheme | null {
  switch (value) {
    case 'system':
    case 'dark':
    case 'light':
      return value
    default:
      return null
  }
}

function getParamsFromSearchParams(searchParams: URLSearchParams): URLParams {
  try {
    const result: URLParams = {}

    const profileURL = searchParams.get('profileURL')
    if (profileURL !== null) {
      result.profileURL = profileURL
    }

    const baseProfileURL = searchParams.get('baseProfileURL')
    if (baseProfileURL !== null) {
      result.baseProfileURL = baseProfileURL
    }

    const title = searchParams.get('title')
    if (title !== null) {
      result.title = title
    }

    const localProfilePath = searchParams.get('localProfilePath')
    if (localProfilePath !== null) {
      result.localProfilePath = localProfilePath
    }

    const view = searchParams.get('view')
    if (view !== null) {
      const mode = getViewMode(view)
      if (mode !== null) {
        result.viewMode = mode
      } else {
        console.error(`Ignoring invalid view specifier: ${view}`)
      }
    }

    if (searchParams.has('embedded')) {
      result.embedded = true
    }

    if (searchParams.has('trimUnknownLeafs')) {
      result.trimUnknownLeafs = true
    }

    if (searchParams.has('trimUnknownRoots')) {
      result.trimUnknownRoots = true
    }

    const theme = searchParams.get('theme')
    if (theme !== null) {
      const urlTheme = getTheme(theme)
      if (urlTheme !== null) {
        result.theme = urlTheme
      }
    }

    const sourceLinks: SourceLinkRule[] = []
    for (const sourceLink of searchParams.getAll('sourceLink')) {
      const separatorIndex = sourceLink.indexOf('=')
      const namespacePrefix = sourceLink.slice(0, separatorIndex).replace(/\.+$/, '')
      const urlTemplate = sourceLink.slice(separatorIndex + 1)
      if (!namespacePrefix || !urlTemplate.includes('%s')) {
        console.error(`Ignoring invalid source link rule: ${sourceLink}`)
        continue
      }
      sourceLinks.push({namespacePrefix, urlTemplate})
    }
    if (sourceLinks.length > 0) {
      result.sourceLinks = sourceLinks
    }

    return result
  } catch (e) {
    console.error(`Error when loading URL parameters.`)
    console.error(e)
    return {}
  }
}

export function getURLParams(searchContents = window.location.search): URLParams {
  return getParamsFromSearchParams(new URLSearchParams(searchContents))
}
