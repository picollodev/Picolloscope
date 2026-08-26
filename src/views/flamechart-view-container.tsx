import {h} from 'preact'
import {CanvasContext} from '../gl/canvas-context'
import {Flamechart} from '../lib/flamechart'
import {FlamechartRenderer, FlamechartRendererOptions} from '../gl/flamechart-renderer'
import {ProfileFrame, Profile, CallTreeNode} from '../lib/profile'
import {memoizeByShallowEquality} from '../lib/utils'
import {FlamechartView} from './flamechart-view'
import {
  getRowAtlas,
  createGetColorBucketForFrame,
  getCanvasContext,
  createGetCSSColorForFrame,
  getFrameToColorBucket,
} from '../app-state/getters'
import {Vec2, Rect} from '../lib/math'
import {memo, useCallback} from 'preact/compat'
import {ActiveProfileState} from '../app-state/active-profile-state'
import {FlamechartSearchContextProvider} from './flamechart-search-view'
import {Theme, useTheme} from './themes/theme'
import {FlamechartID, FlamechartViewState} from '../app-state/profile-group'
import {metadataFormattingAtom, profileGroupAtom} from '../app-state'
import {MetadataFormatting} from '../lib/metadata-formatting'
import {useAtom} from '../lib/atom'

interface FlamechartSetters {
  setLogicalSpaceViewportSize: (logicalSpaceViewportSize: Vec2) => void
  setConfigSpaceViewportRect: (configSpaceViewportRect: Rect) => void
  setNodeHover: (hover: {node: CallTreeNode; event: MouseEvent} | null) => void
  setSelectedNode: (node: CallTreeNode | null) => void
}

export function useFlamechartSetters(id: FlamechartID): FlamechartSetters {
  return {
    setNodeHover: useCallback(
      (hover: {node: CallTreeNode; event: MouseEvent} | null) => {
        profileGroupAtom.setFlamechartHoveredNode(id, hover)
      },
      [id],
    ),
    setLogicalSpaceViewportSize: useCallback(
      (logicalSpaceViewportSize: Vec2) => {
        profileGroupAtom.setLogicalSpaceViewportSize(id, logicalSpaceViewportSize)
      },
      [id],
    ),
    setConfigSpaceViewportRect: useCallback(
      (configSpaceViewportRect: Rect) => {
        profileGroupAtom.setConfigSpaceViewportRect(id, configSpaceViewportRect)
      },
      [id],
    ),
    setSelectedNode: useCallback(
      (selectedNode: CallTreeNode | null) => {
        profileGroupAtom.setSelectedNode(id, selectedNode)
      },
      [id],
    ),
  }
}

export type FlamechartViewProps = {
  theme: Theme
  canvasContext: CanvasContext
  flamechart: Flamechart
  flamechartRenderer: FlamechartRenderer
  renderInverted: boolean
  highlightHoveredFrame: boolean
  getCSSColorForFrame: (frame: ProfileFrame) => string
  metadataFormatting: MetadataFormatting
} & FlamechartSetters &
  FlamechartViewState

export const getChronoViewFlamechart = memoizeByShallowEquality(
  ({profile, getColorBucketForFrame}: {profile: Profile; getColorBucketForFrame: (frame: ProfileFrame) => number}): Flamechart => {
    return new Flamechart({
      getTotalWeight: profile.getTotalWeight.bind(profile),
      forEachCall: profile.forEachCall.bind(profile),
      formatValue: profile.formatValue.bind(profile),
      getColorBucketForFrame,
    })
  },
)

export const createMemoizedFlamechartRenderer = (options?: FlamechartRendererOptions) =>
  memoizeByShallowEquality(({canvasContext, flamechart}: {canvasContext: CanvasContext; flamechart: Flamechart}): FlamechartRenderer => {
    return new FlamechartRenderer(
      canvasContext.gl,
      getRowAtlas(canvasContext),
      flamechart,
      canvasContext.rectangleBatchRenderer,
      canvasContext.flamechartColorPassRenderer,
      options,
    )
  })

const getChronoViewFlamechartRenderer = createMemoizedFlamechartRenderer()

export interface FlamechartViewContainerProps {
  activeProfileState: ActiveProfileState
  glCanvas: HTMLCanvasElement
}

export const ChronoFlamechartView = memo((props: FlamechartViewContainerProps) => {
  const {activeProfileState, glCanvas} = props
  const {profile, chronoViewState} = activeProfileState

  const theme = useTheme()
  const metadataFormatting = useAtom(metadataFormattingAtom)

  const canvasContext = getCanvasContext({theme, canvas: glCanvas})
  const frameToColorBucket = getFrameToColorBucket(profile)
  const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket)
  const getCSSColorForFrame = createGetCSSColorForFrame({theme, frameToColorBucket})

  const flamechart = getChronoViewFlamechart({profile, getColorBucketForFrame})
  const flamechartRenderer = getChronoViewFlamechartRenderer({
    canvasContext,
    flamechart,
  })

  const setters = useFlamechartSetters(FlamechartID.CHRONO)

  return (
    <FlamechartSearchContextProvider
      flamechart={flamechart}
      selectedNode={chronoViewState.selectedNode}
      setSelectedNode={setters.setSelectedNode}
      configSpaceViewportRect={chronoViewState.configSpaceViewportRect}
      setConfigSpaceViewportRect={setters.setConfigSpaceViewportRect}
    >
      <FlamechartView
        theme={theme}
        renderInverted={false}
        highlightHoveredFrame={false}
        flamechart={flamechart}
        flamechartRenderer={flamechartRenderer}
        canvasContext={canvasContext}
        getCSSColorForFrame={getCSSColorForFrame}
        metadataFormatting={metadataFormatting}
        {...chronoViewState}
        {...setters}
      />
    </FlamechartSearchContextProvider>
  )
})

export const getLeftHeavyFlamechart = memoizeByShallowEquality(
  ({profile, getColorBucketForFrame}: {profile: Profile; getColorBucketForFrame: (frame: ProfileFrame) => number}): Flamechart => {
    return new Flamechart({
      getTotalWeight: profile.getTotalNonIdleWeight.bind(profile),
      forEachCall: profile.forEachCallGrouped.bind(profile),
      formatValue: profile.formatValue.bind(profile),
      getColorBucketForFrame,
    })
  },
)

const getLeftHeavyFlamechartRenderer = createMemoizedFlamechartRenderer()

export const LeftHeavyFlamechartView = memo((ownProps: FlamechartViewContainerProps) => {
  const {activeProfileState, glCanvas} = ownProps

  const {profile, leftHeavyViewState} = activeProfileState

  const theme = useTheme()
  const metadataFormatting = useAtom(metadataFormattingAtom)

  const canvasContext = getCanvasContext({theme, canvas: glCanvas})
  const frameToColorBucket = getFrameToColorBucket(profile)
  const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket)
  const getCSSColorForFrame = createGetCSSColorForFrame({theme, frameToColorBucket})

  const flamechart = getLeftHeavyFlamechart({
    profile,
    getColorBucketForFrame,
  })
  const flamechartRenderer = getLeftHeavyFlamechartRenderer({
    canvasContext,
    flamechart,
  })

  const setters = useFlamechartSetters(FlamechartID.LEFT_HEAVY)

  return (
    <FlamechartSearchContextProvider
      flamechart={flamechart}
      selectedNode={leftHeavyViewState.selectedNode}
      setSelectedNode={setters.setSelectedNode}
      configSpaceViewportRect={leftHeavyViewState.configSpaceViewportRect}
      setConfigSpaceViewportRect={setters.setConfigSpaceViewportRect}
    >
      <FlamechartView
        theme={theme}
        renderInverted={false}
        highlightHoveredFrame={true}
        flamechart={flamechart}
        flamechartRenderer={flamechartRenderer}
        canvasContext={canvasContext}
        getCSSColorForFrame={getCSSColorForFrame}
        metadataFormatting={metadataFormatting}
        {...leftHeavyViewState}
        {...setters}
      />
    </FlamechartSearchContextProvider>
  )
})
