import {CallTreeNode} from '../lib/profile'
import {css} from 'aphrodite'
import {h} from 'preact'
import {commonStyle} from './style'
import {Rect, AffineTransform, Vec2} from '../lib/math'
import {FlamechartPanZoomView} from './flamechart-pan-zoom-view'
import {noop} from '../lib/utils'
import {Hovertip} from './hovertip'
import {FlamechartViewProps} from './flamechart-view-container'
import {StatelessComponent} from '../lib/preact-helpers'

export class FlamechartWrapper extends StatelessComponent<FlamechartViewProps> {
  private clampViewportToFlamegraph(viewportRect: Rect) {
    const {flamechart, renderInverted} = this.props
    return flamechart.getClampedConfigSpaceViewportRect({
      configSpaceViewportRect: viewportRect,
      renderInverted,
    })
  }
  private setConfigSpaceViewportRect = (configSpaceViewportRect: Rect) => {
    this.props.setConfigSpaceViewportRect(this.clampViewportToFlamegraph(configSpaceViewportRect))
  }
  private setLogicalSpaceViewportSize = (logicalSpaceViewportSize: Vec2): void => {
    this.props.setLogicalSpaceViewportSize(logicalSpaceViewportSize)
  }

  private transformViewport = (transform: AffineTransform) => {
    this.setConfigSpaceViewportRect(transform.transformRect(this.props.configSpaceViewportRect))
  }
  private renderTooltip() {
    if (!this.container) return null
    const {hover} = this.props
    const {width, height, left, top} = this.container.getBoundingClientRect()
    const offset = hover ? new Vec2(hover.event.clientX - left, hover.event.clientY - top) : null

    return (
      <Hovertip
        containerSize={new Vec2(width, height)}
        offset={offset}
        frame={hover?.node.frame ?? null}
        node={hover?.node}
        formatValue={this.props.flamechart.formatValue.bind(this.props.flamechart)}
        totalWeight={this.props.flamechart.getTotalWeight()}
      />
    )
  }
  container: HTMLDivElement | null = null
  containerRef = (container: Element | null) => {
    this.container = (container as HTMLDivElement) || null
  }
  private setNodeHover = (
    hover: {
      node: CallTreeNode
      event: MouseEvent
    } | null,
  ) => {
    this.props.setNodeHover(hover)
  }
  render() {
    return (
      <div className={css(commonStyle.fillY, commonStyle.fillX, commonStyle.vbox)} ref={this.containerRef}>
        <FlamechartPanZoomView
          theme={this.props.theme}
          metadataFormatting={this.props.metadataFormatting}
          selectedNode={null}
          highlightHoveredFrame={true}
          onNodeHover={this.setNodeHover}
          onNodeSelect={noop}
          configSpaceViewportRect={this.props.configSpaceViewportRect}
          setConfigSpaceViewportRect={this.setConfigSpaceViewportRect}
          transformViewport={this.transformViewport}
          flamechart={this.props.flamechart}
          flamechartRenderer={this.props.flamechartRenderer}
          canvasContext={this.props.canvasContext}
          renderInverted={this.props.renderInverted}
          logicalSpaceViewportSize={this.props.logicalSpaceViewportSize}
          setLogicalSpaceViewportSize={this.setLogicalSpaceViewportSize}
          searchResults={null}
        />
        {this.renderTooltip()}
      </div>
    )
  }
}
