import {ProfileFrame} from './profile'
import {SourceLinkRule} from './url-params'

const SYSTEM_SOURCE_LINK: SourceLinkRule = {
  namespacePrefix: 'System',
  urlTemplate: 'https://source.dot.net/#q=%s',
}

function getSearchString(frame: ProfileFrame): string | null {
  const method = frame.frameInfo.methodMetadata
  if (method == null) return null

  const declaringType = method.declaringType.namespace
    ? `${method.declaringType.namespace}.${method.declaringType.name}`
    : method.declaringType.name
  const searchString = `${declaringType}.${method.name}`
  const genericStart = searchString.indexOf('<')
  if (genericStart < 0) return searchString

  const genericEnd = searchString.indexOf('>', genericStart + 1)
  return genericEnd < 0 ? searchString.slice(0, genericStart) : searchString.slice(0, genericEnd + 1)
}

export function getSourceCodeLink(frame: ProfileFrame, configuredRules: SourceLinkRule[] | undefined): string | null {
  const method = frame.frameInfo.methodMetadata
  if (method == null) return null

  const rule = [...(configuredRules ?? []), SYSTEM_SOURCE_LINK].find(rule => {
    const declaringType = method.declaringType.namespace
      ? `${method.declaringType.namespace}.${method.declaringType.name}`
      : method.declaringType.name
    return declaringType === rule.namespacePrefix || declaringType.startsWith(`${rule.namespacePrefix}.`)
  })
  if (rule == null) return null

  const searchString = getSearchString(frame)
  return searchString == null ? null : rule.urlTemplate.replace('%s', encodeURIComponent(searchString))
}
