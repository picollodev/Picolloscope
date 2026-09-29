import {useMemo} from 'preact/hooks'
import {Profile, ProfileFrame} from '../lib/profile'
import {ProfileSearchResults} from '../lib/profile-search'
import {MetadataFormatting} from '../lib/metadata-formatting'
import {SortMethod, SortField, SortDirection} from '../app-state'
import {sortBy} from '../lib/utils'

export function useProfileTableData(profile: Profile, tableSortMethod: SortMethod, metadataFormatting: MetadataFormatting, profileSearchResults: ProfileSearchResults | null, includeRootRow = true) {
  const rowList: ProfileFrame[] = useMemo(() => {
    const rowList: ProfileFrame[] = []
    let summedSelfWeight = 0
    let summedBaseSelfWeight = 0

    profile.forEachFrame(frame => {
      summedSelfWeight += frame.selfWeight
      summedBaseSelfWeight += frame.baseSelfWeight ?? 0

      if (profileSearchResults && !profileSearchResults.getMatchForFrame(frame)) {
        return
      }
      rowList.push(frame)
    })

    if (includeRootRow) {
      const rootTotalWeight = profile.getTotalNonIdleWeight()
      const rootFrame = new ProfileFrame(-1, {name: '(root)'})
      rootFrame.addToTotalWeight(rootTotalWeight)
      rootFrame.addToSelfWeight(rootTotalWeight - summedSelfWeight - 0.000000001)

      if (profile.hasBaseProfile) {
        const baseTotalWeight = profile.getBaseTotalNonIdleWeight()!
        rootFrame.setBaseWeights(baseTotalWeight - summedBaseSelfWeight, baseTotalWeight)
      }

      rowList.push(rootFrame)
    }

    switch (tableSortMethod.field) {
      case SortField.SYMBOL_NAME: {
        sortBy(rowList, f => f.getDisplayName(metadataFormatting).toLowerCase())
        break
      }
      case SortField.SELF: {
        sortBy(rowList, f => f.selfWeight)
        break
      }
      case SortField.TOTAL: {
        sortBy(rowList, f => f.totalWeight)
        break
      }
      case SortField.SELF_DELTA: {
        sortBy(rowList, f => Math.abs(profile.getWeightShareBasisPointDelta(f.selfWeight, f.baseSelfWeight ?? 0)))
        break
      }
      case SortField.TOTAL_DELTA: {
        sortBy(rowList, f => Math.abs(profile.getWeightShareBasisPointDelta(f.totalWeight, f.baseTotalWeight ?? 0)))
        break
      }
    }
    if (tableSortMethod.direction === SortDirection.DESCENDING) {
      rowList.reverse()
    }

    return rowList
  }, [profile, profileSearchResults, tableSortMethod, metadataFormatting, includeRootRow])

  const getIndexForFrame: (frame: ProfileFrame) => number | null = useMemo(() => {
    const indexByFrame = new Map<ProfileFrame, number>()
    for (let i = 0; i < rowList.length; i++) {
      indexByFrame.set(rowList[i], i)
    }
    return (frame: ProfileFrame) => {
      const index = indexByFrame.get(frame)
      return index == null ? null : index
    }
  }, [rowList])

  const getSearchMatchForFrame: (frame: ProfileFrame) => [number, number][] | null = useMemo(() => {
    return (frame: ProfileFrame) => {
      if (profileSearchResults == null) return null
      return profileSearchResults.getMatchForFrame(frame)
    }
  }, [profileSearchResults])

  return {rowList, getIndexForFrame, getSearchMatchForFrame}
}
