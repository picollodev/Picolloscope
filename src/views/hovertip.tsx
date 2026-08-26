import {Vec2} from '../lib/math'
import {CallTreeNode, ProfileFrame} from '../lib/profile'
import {formatPercent} from '../lib/utils'
import {Sizes, FontSize, FontFamily, ZIndex} from './style'
import {css, StyleSheet} from 'aphrodite'
import {h} from 'preact'
import {useTheme, withTheme} from './themes/theme'
import {useCallback, useEffect, useRef, useState} from 'preact/hooks'
import {formatParameterMetadata, formatTypeMetadata, MetadataFormatting} from '../lib/metadata-formatting'
import {urlParamsAtom} from '../app-state'
import {useAtom} from '../lib/atom'
import {getSourceCodeLink} from '../lib/source-code-links'

const SINGLE_LINE_NAME_MAX_LENGTH = 80

interface HovertipProps {
  containerSize: Vec2
  offset: Vec2 | null
  frame: ProfileFrame | null
  node?: CallTreeNode
  formatValue: (weight: number) => string
  totalWeight: number
}

export function Hovertip(props: HovertipProps) {
  const style = getStyle(useTheme())
  const urlParams = useAtom(urlParamsAtom)
  const closeTimeout = useRef<number | null>(null)
  const pointerInside = useRef(false)
  const content = useRef<{frame: ProfileFrame; node?: CallTreeNode; offset: Vec2} | null>(null)
  const [visible, setVisible] = useState(props.frame != null && props.offset != null)

  if (
    props.frame != null &&
    props.offset != null &&
    (!visible || content.current?.frame !== props.frame || content.current.node !== props.node)
  ) {
    content.current = {frame: props.frame, node: props.node, offset: props.offset}
  }

  const cancelClose = useCallback(() => {
    if (closeTimeout.current != null) {
      window.clearTimeout(closeTimeout.current)
      closeTimeout.current = null
    }
  }, [])

  useEffect(() => {
    if (props.frame != null && props.offset != null) {
      cancelClose()
      setVisible(true)
      return
    }

    if (pointerInside.current) return

    closeTimeout.current = window.setTimeout(() => {
      closeTimeout.current = null
      setVisible(false)
    }, 100)

    return cancelClose
  }, [props.frame, props.offset, cancelClose])

  if (!visible || content.current == null) return null

  const {containerSize} = props
  const {frame, node, offset} = content.current
  const containerWidth = containerSize.x
  const containerHeight = containerSize.y
  const sourceCodeLink = getSourceCodeLink(frame, urlParams.sourceLinks)

  const OFFSET_FROM_MOUSE = 7

  const updateLocation = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return

      const clientRect = el.getBoundingClientRect()

      // Place the hovertip to the right of the cursor.
      let leftEdgeX = offset.x + OFFSET_FROM_MOUSE

      // If this would cause it to overflow the container, align the right
      // edge of the hovertip with the right edge of the container.
      if (leftEdgeX + clientRect.width > containerWidth - 1) {
        leftEdgeX = containerWidth - clientRect.width - 1

        // If aligning the right edge overflows the container, align the left edge
        // of the hovertip with the left edge of the container.
        if (leftEdgeX < 1) {
          leftEdgeX = 1
        }
      }
      el.style.left = `${leftEdgeX}px`

      // Place the tooltip below the cursor
      let topEdgeY = offset.y + OFFSET_FROM_MOUSE

      // If this would cause it to overflow the container, place the hovertip
      // above the cursor instead. This intentionally differs from the horizontal
      // axis logic to avoid the cursor being in the middle of a hovertip when
      // possible.
      if (topEdgeY + clientRect.height > containerHeight - 1) {
        topEdgeY = offset.y - clientRect.height - 1

        // If placing the hovertip above the cursor overflows the container, align
        // the top edge of the hovertip with the top edge of the container.
        if (topEdgeY < 1) {
          topEdgeY = 1
        }
      }
      el.style.top = `${topEdgeY}px`
    },
    [containerWidth, containerHeight, offset.x, offset.y],
  )

  return (
    <div
      className={css(style.hoverTip)}
      ref={updateLocation}
      onMouseEnter={() => {
        pointerInside.current = true
        cancelClose()
      }}
      onMouseLeave={() => {
        pointerInside.current = false
        setVisible(false)
      }}>
      <div className={css(style.hoverTipRow)}>
        <FrameName frame={frame} />
        {sourceCodeLink != null && (
          <a className={css(style.sourceLink)} href={sourceCodeLink} target='_blank' rel='noreferrer'>
            Source
          </a>
        )}
        {frame.file ? (
          <div className={css(style.moduleName)}>
            {frame.file}
            {frame.line != null ? `:${frame.line}` : null}
          </div>
        ) : undefined}
        <div className={css(style.statistics)}>
          {node != null && (
            <StatisticsRow
              label='This instance:'
              total={node.totalWeight}
              self={node.selfWeight}
              grandTotal={props.totalWeight}
              formatValue={props.formatValue}
            />
          )}
          <StatisticsRow
            label='All instances:'
            total={frame.totalWeight}
            self={frame.selfWeight}
            grandTotal={props.totalWeight}
            formatValue={props.formatValue}
          />
        </div>
      </div>
    </div>
  )
}

function FrameName({frame}: {frame: ProfileFrame}) {
  const style = getStyle(useTheme())
  const method = frame.frameInfo.methodMetadata
  const fullName = frame.getDisplayName(MetadataFormatting.FULL)

  if (method == null || fullName.length <= SINGLE_LINE_NAME_MAX_LENGTH) {
    return <div className={css(style.frameName)}>{fullName}</div>
  }

  return (
    <div className={css(style.frameName)}>
      <div>
        {formatTypeMetadata(method.declaringType, MetadataFormatting.FULL)}.{method.name}({'\u00a0'}
      </div>
      <div className={css(style.parameters)}>
        {method.parameters.map((parameter, index) => (
          <div key={index}>
            {formatParameterMetadata(parameter, MetadataFormatting.FULL)}
            {index + 1 < method.parameters.length ? ',' : ''}
          </div>
        ))}
      </div>
      <div>
        ){method.returnType == null ? null : ` : ${formatTypeMetadata(method.returnType, MetadataFormatting.FULL)}`}
      </div>
    </div>
  )
}

interface StatisticsRowProps {
  label: string
  total: number
  self: number
  grandTotal: number
  formatValue: (weight: number) => string
}

function StatisticsRow({label, total, self, grandTotal, formatValue}: StatisticsRowProps) {
  const style = getStyle(useTheme())
  return (
    <div className={css(style.statisticsRow)}>
      <span className={css(style.statisticsLabel)}>{label}</span>
      <span>Total</span>
      <span>{formatValue(total)}</span>
      <span>{formatPercent((100 * total) / grandTotal)}</span>
      <span className={css(style.selfLabel)}>Self</span>
      <span>{formatValue(self)}</span>
      <span>{formatPercent((100 * self) / grandTotal)}</span>
    </div>
  )
}

const HOVERTIP_PADDING = 2

const getStyle = withTheme(theme =>
  StyleSheet.create({
    hoverTip: {
      position: 'absolute',
      background: theme.bgPrimaryColor,
      border: '1px solid black',
      maxWidth: `min(${Sizes.TOOLTIP_WIDTH_MAX}px, 50vw)`,
      paddingTop: HOVERTIP_PADDING,
      paddingBottom: HOVERTIP_PADDING,
      userSelect: 'text',
      fontSize: FontSize.LABEL,
      fontFamily: FontFamily.MONOSPACE,
      zIndex: ZIndex.HOVERTIP,
    },
    hoverTipRow: {
      paddingLeft: HOVERTIP_PADDING,
      paddingRight: HOVERTIP_PADDING,
      overflowWrap: 'anywhere',
    },
    frameName: {
      whiteSpace: 'pre-wrap',
      lineHeight: 1,
    },
    parameters: {
      paddingLeft: '2ch',
    },
    moduleName: {
      marginTop: HOVERTIP_PADDING,
    },
    sourceLink: {
      display: 'inline-block',
      marginTop: HOVERTIP_PADDING,
    },
    statistics: {
      marginTop: HOVERTIP_PADDING,
      fontVariantNumeric: 'tabular-nums',
    },
    statisticsRow: {
      display: 'grid',
      gridTemplateColumns: 'max-content max-content 7ch 7ch max-content 7ch 7ch',
      columnGap: '0.5ch',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      textAlign: 'right',
    },
    statisticsLabel: {
      textAlign: 'left',
    },
    selfLabel: {
      marginLeft: '2ch',
    },
  }),
)
