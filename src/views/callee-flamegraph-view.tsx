import {memoizeByShallowEquality, noop} from '../lib/utils'
import {Profile, ProfileFrame} from '../lib/profile'
import {Flamechart} from '../lib/flamechart'
import {createMemoizedFlamechartRenderer, FlamechartViewContainerProps, useFlamechartSetters} from './flamechart-view-container'
import {getCanvasContext, createGetColorBucketForFrame, createGetCSSColorForFrame, getFrameToColorBucket} from '../app-state/getters'
import {FlamechartWrapper} from './flamechart-wrapper'
import {h} from 'preact'
import {memo} from 'preact/compat'
import {useTheme} from './themes/theme'
import {FlamechartID} from '../app-state/profile-group'
import {flattenRecursionAtom, glCanvasAtom, metadataFormattingAtom, profileGroupAtom} from '../app-state'
import {useAtom} from '../lib/atom'

const getCalleeProfile = memoizeByShallowEquality<
  {
    profile: Profile
    frame: ProfileFrame
    flattenRecursion: boolean
  },
  Profile
>(({profile, frame, flattenRecursion}) => {
  let p = frame.key === -1 ? profile : profile.getProfileForCalleesOf(frame)
  return flattenRecursion ? p.getProfileWithRecursionFlattened() : p
})

const getCalleeFlamegraph = memoizeByShallowEquality<
  {
    calleeProfile: Profile
    getColorBucketForFrame: (frame: ProfileFrame) => number
  },
  Flamechart
>(({calleeProfile, getColorBucketForFrame}) => {
  return new Flamechart({
    getTotalWeight: calleeProfile.getTotalNonIdleWeight.bind(calleeProfile),
    forEachCall: calleeProfile.forEachCallGrouped.bind(calleeProfile),
    formatValue: calleeProfile.formatValue.bind(calleeProfile),
    getColorBucketForFrame,
  })
})

const getCalleeFlamegraphRenderer = createMemoizedFlamechartRenderer()

export const CalleeFlamegraphView = memo((ownProps: FlamechartViewContainerProps) => {
  const {activeProfileState} = ownProps
  const {profile, sandwichViewState} = activeProfileState
  const flattenRecursion = useAtom(flattenRecursionAtom)
  const glCanvas = useAtom(glCanvasAtom)
  const theme = useTheme()
  const metadataFormatting = useAtom(metadataFormattingAtom)

  if (!profile) throw new Error('profile missing')
  if (!glCanvas) throw new Error('glCanvas missing')
  const {callerCallee} = sandwichViewState
  if (!callerCallee) throw new Error('callerCallee missing')
  const {selectedFrame} = callerCallee

  const frameToColorBucket = getFrameToColorBucket(profile)
  const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket)
  const getCSSColorForFrame = createGetCSSColorForFrame({theme, frameToColorBucket})
  const canvasContext = getCanvasContext({theme, canvas: glCanvas})

  const flamechart = getCalleeFlamegraph({
    calleeProfile: getCalleeProfile({profile, frame: selectedFrame, flattenRecursion}),
    getColorBucketForFrame,
  })
  const flamechartRenderer = getCalleeFlamegraphRenderer({canvasContext, flamechart})

  return (
    <FlamechartWrapper
      theme={theme}
      renderInverted={false}
      highlightHoveredFrame={true}
      flamechart={flamechart}
      flamechartRenderer={flamechartRenderer}
      canvasContext={canvasContext}
      getCSSColorForFrame={getCSSColorForFrame}
      metadataFormatting={metadataFormatting}
      onMiddleClick={node => profileGroupAtom.setSelectedFrame(profile.getOrCreateProfileFrame(node.frame.key))}
      getAllInstancesFrame={frame => profile.getOrCreateProfileFrame(frame.key)}
      hovertipTotalWeight={profile.getTotalNonIdleWeight()}
      {...useFlamechartSetters(FlamechartID.SANDWICH_CALLEES)}
      {...callerCallee.calleeFlamegraph}
      // This overrides the setSelectedNode specified in useFlamechartSettesr
      setSelectedNode={noop}
    />
  )
})
