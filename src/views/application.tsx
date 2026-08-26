import '../../assets/reset.css'
import '../../assets/source-code-pro.css'

import { h } from 'preact'
import { StyleSheet, css } from 'aphrodite'

import { ProfileGroup } from '../lib/profile'
import { FontFamily, FontSize, Duration } from './style'
import { ActiveProfileState } from '../app-state/active-profile-state'
import { LeftHeavyFlamechartView, ChronoFlamechartView } from './flamechart-view-container'
import { CanvasContext } from '../gl/canvas-context'
import { Toolbar } from './toolbar'
import { Theme, withTheme } from './themes/theme'
import { ViewMode } from '../lib/view-mode'
import { canUseXHR } from '../app-state'
import { ProfileGroupState } from '../app-state/profile-group'
import { URLParams } from '../lib/url-params'
import { StatelessComponent } from '../lib/preact-helpers'
import { SandwichViewContainer } from './sandwich-view'
import { importProfilesFromFile, importProfilesFromUrl } from '../lib/import'
import { enableTimelineView } from '../lib/features'
import { MetadataFormatting } from '../lib/metadata-formatting'

const exampleProfileURL = 'sample.json'

interface GLCanvasProps {
  canvasContext: CanvasContext | null
  theme: Theme
  setGLCanvas: (canvas: HTMLCanvasElement | null) => void
}
export class GLCanvas extends StatelessComponent<GLCanvasProps> {
  private canvas: HTMLCanvasElement | null = null

  private ref = (canvas: Element | null) => {
    if (canvas instanceof HTMLCanvasElement) {
      this.canvas = canvas
    } else {
      this.canvas = null
    }

    this.props.setGLCanvas(this.canvas)
  }

  private container: HTMLElement | null = null
  private containerRef = (container: Element | null) => {
    if (container instanceof HTMLElement) {
      this.container = container
    } else {
      this.container = null
    }
  }

  private maybeResize = () => {
    if (!this.container) return
    if (!this.props.canvasContext) return

    let { width, height } = this.container.getBoundingClientRect()

    const widthInAppUnits = width
    const heightInAppUnits = height
    const widthInPixels = width * window.devicePixelRatio
    const heightInPixels = height * window.devicePixelRatio

    this.props.canvasContext.gl.resize(widthInPixels, heightInPixels, widthInAppUnits, heightInAppUnits)
  }

  onWindowResize = () => {
    if (this.props.canvasContext) {
      this.props.canvasContext.requestFrame()
    }
  }
  componentWillReceiveProps(nextProps: GLCanvasProps) {
    if (this.props.canvasContext !== nextProps.canvasContext) {
      if (this.props.canvasContext) {
        this.props.canvasContext.removeBeforeFrameHandler(this.maybeResize)
      }
      if (nextProps.canvasContext) {
        nextProps.canvasContext.addBeforeFrameHandler(this.maybeResize)
        nextProps.canvasContext.requestFrame()
      }
    }
  }
  componentDidMount() {
    window.addEventListener('resize', this.onWindowResize)
  }
  componentWillUnmount() {
    if (this.props.canvasContext) {
      this.props.canvasContext.removeBeforeFrameHandler(this.maybeResize)
    }
    window.removeEventListener('resize', this.onWindowResize)
  }
  render() {
    const style = getStyle(this.props.theme)
    return (
      <div ref={this.containerRef} className={css(style.glCanvasView)}>
        <canvas ref={this.ref} width={1} height={1} />
      </div>
    )
  }
}

export type ApplicationProps = {
  setGLCanvas: (canvas: HTMLCanvasElement | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: boolean) => void
  setProfileGroup: (profileGroup: ProfileGroup) => void
  setDragActive: (dragActive: boolean) => void
  setViewMode: (viewMode: ViewMode) => void
  setFlattenRecursion: (flattenRecursion: boolean) => void
  setMetadataFormatting: (formatting: MetadataFormatting) => void
  setProfileIndexToView: (profileIndex: number) => void
  activeProfileState: ActiveProfileState | null
  canvasContext: CanvasContext | null
  theme: Theme
  profileGroup: ProfileGroupState
  flattenRecursion: boolean
  metadataFormatting: MetadataFormatting
  viewMode: ViewMode
  urlParams: URLParams
  dragActive: boolean
  loading: boolean
  glCanvas: HTMLCanvasElement | null
  error: boolean
}

export class Application extends StatelessComponent<ApplicationProps> {
  private isEmbedded() {
    return this.props.urlParams.embedded === true
  }

  private async loadProfile(loader: () => Promise<ProfileGroup | null>) {
    this.props.setError(false)
    this.props.setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 0))

    if (!this.props.glCanvas) return

    console.time('import')

    let profileGroup: ProfileGroup | null = null
    try {
      profileGroup = await loader()
    } catch (e) {
      console.log('Failed to load format', e)
      this.props.setError(true)
      this.props.setLoading(false)
      return
    }

    // TODO(jlfwong): Make these into nicer overlays
    if (profileGroup == null) {
      alert('Unrecognized format! See documentation about supported formats.')
      this.props.setLoading(false)
      return
    } else if (profileGroup.profiles.length === 0) {
      alert("Successfully imported profile, but it's empty!")
      this.props.setLoading(false)
      return
    }

    if (this.props.urlParams.title) {
      profileGroup.name = this.props.urlParams.title;
      // profileGroup = {
      //   ...profileGroup,
      //   name: this.props.urlParams.title,
      // }
    }

    document.title = `${profileGroup.name} - speedscope`

    if (this.props.urlParams.viewMode != null && (enableTimelineView || this.props.urlParams.viewMode !== ViewMode.CHRONO_FLAME_CHART)) {
      this.props.setViewMode(this.props.urlParams.viewMode)
    }

    console.timeEnd('import')

    this.props.setProfileGroup(profileGroup)
    this.props.setLoading(false)
  }

  getStyle(): ReturnType<typeof getStyle> {
    return getStyle(this.props.theme)
  }

  loadFromFile(file: File) {
    if (this.isEmbedded()) return

    this.loadProfile(async () => {
      const profiles = await importProfilesFromFile(file, {
        trimUnknownLeafs: this.props.urlParams.trimUnknownLeafs,
        trimUnknownRoots: this.props.urlParams.trimUnknownRoots,
      })
      if (profiles) {
        for (let profile of profiles.profiles) {
          if (!profile.name) {
            profile.name = file.name
          }
        }
        return profiles
      }

      return null
    })
  }

  loadExample = () => {
    if (this.isEmbedded()) return

    this.loadProfile(async () => {
      return await importProfilesFromUrl(exampleProfileURL, undefined, {
        trimUnknownLeafs: this.props.urlParams.trimUnknownLeafs,
        trimUnknownRoots: this.props.urlParams.trimUnknownRoots,
      })
    })
  }

  onDrop = (ev: DragEvent) => {
    this.props.setDragActive(false)
    ev.preventDefault()

    if (this.isEmbedded()) return
    if (!ev.dataTransfer) return

    let file: File | null = ev.dataTransfer.files.item(0)
    if (file) {
      this.loadFromFile(file)
    }
  }

  onDragOver = (ev: DragEvent) => {
    ev.preventDefault()
    if (!this.isEmbedded()) {
      this.props.setDragActive(true)
    }
  }

  onDragLeave = (ev: DragEvent) => {
    this.props.setDragActive(false)
    ev.preventDefault()
  }

  onWindowKeyPress = async (ev: KeyboardEvent) => {
    if (ev.key === 'l' && enableTimelineView) {
      this.props.setViewMode(ViewMode.CHRONO_FLAME_CHART)
    } else if (ev.key === 'f') {
      this.props.setViewMode(ViewMode.LEFT_HEAVY_FLAME_GRAPH)
    } else if (ev.key === 's') {
      this.props.setViewMode(ViewMode.SANDWICH_VIEW)
    } else if (ev.key === 'r') {
      const { flattenRecursion } = this.props
      this.props.setFlattenRecursion(!flattenRecursion)
    } else if (ev.key === 'm') {
      const nextFormatting =
        this.props.metadataFormatting === MetadataFormatting.MINIMAL
          ? MetadataFormatting.FULL
          : this.props.metadataFormatting + 1
      this.props.setMetadataFormatting(nextFormatting)
    } else if (ev.key === 'n' || ev.key === '.') {
      const { activeProfileState } = this.props
      if (activeProfileState) {
        this.props.setProfileIndexToView(activeProfileState.index + 1)
      }
    } else if (ev.key === 'p' || ev.key === ',') {
      const { activeProfileState } = this.props
      if (activeProfileState) {
        this.props.setProfileIndexToView(activeProfileState.index - 1)
      }
    }
  }

  private browseForFile = () => {
    if (this.isEmbedded()) return

    const input = document.createElement('input')
    input.type = 'file'
    input.addEventListener('change', this.onFileSelect)
    input.click()
  }

  private onWindowKeyDown = async (ev: KeyboardEvent) => {
    // This has to be handled on key down in order to prevent the default page save action.
    if (ev.key === 'o' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault()
      this.browseForFile()
    }
  }

  // onDocumentPaste = (ev: Event) => {
  //   if (document.activeElement != null && document.activeElement.nodeName === 'INPUT') return

  //   ev.preventDefault()
  //   ev.stopPropagation()

  //   const clipboardData = (ev as ClipboardEvent).clipboardData
  //   if (!clipboardData) return
  //   const pasted = clipboardData.getData('text')
  //   this.loadProfile(async () => {
  //     return await importProfilesFromText('From Clipboard', pasted)
  //   })
  // }

  componentDidMount() {
    window.addEventListener('keydown', this.onWindowKeyDown)
    window.addEventListener('keypress', this.onWindowKeyPress)
    // document.addEventListener('paste', this.onDocumentPaste)
    this.maybeLoadURLParamProfile()
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.onWindowKeyDown)
    window.removeEventListener('keypress', this.onWindowKeyPress)
    // document.removeEventListener('paste', this.onDocumentPaste)
  }

  async maybeLoadURLParamProfile() {
    const { profileURL, baseProfileURL, embedded, trimUnknownLeafs, trimUnknownRoots } = this.props.urlParams
    if (profileURL) {
      if (!canUseXHR) {
        alert(`Cannot load a profile URL when loading from "${window.location.protocol}" URL protocol`)
        this.props.setError(true)
        this.props.setLoading(false)
        return
      }
      this.loadProfile(async () => {
        return await importProfilesFromUrl(profileURL, embedded ? baseProfileURL : undefined, {
          trimUnknownLeafs,
          trimUnknownRoots,
        })
      })
    } else if (embedded) {
      this.props.setError(true)
    }
  }

  onFileSelect = (ev: Event) => {
    if (this.isEmbedded()) return

    const file = (ev.target as HTMLInputElement).files!.item(0)
    if (file) {
      this.loadFromFile(file)
    }
  }

  renderLanding() {
    const style = this.getStyle()

    return (
      <div className={css(style.landingContainer)}>
        <div className={css(style.landingMessage)}>
          <p className={css(style.landingP)}>
            Welcome to Picolloscope, an interactive{' '}
            <a className={css(style.link)} href="http://www.brendangregg.com/FlameGraphs/cpuflamegraphs.html">
              flamegraph
            </a>{' '}
            visualizer for Picollo.
          </p>
          {canUseXHR ? (
            <p className={css(style.landingP)}>
              Drag and drop a profile file onto this window to get started, click the big blue button below to browse for a profile to
              explore, or{' '}
              <a tabIndex={0} className={css(style.link)} onClick={this.loadExample}>
                click here
              </a>{' '}
              to load an example profile.
            </p>
          ) : (
            <p className={css(style.landingP)}>
              Drag and drop a profile file onto this window to get started, or click the big blue button below to browse for a profile to
              explore.
            </p>
          )}
          <div className={css(style.browseButtonContainer)}>
            <input type="file" name="file" id="file" onChange={this.onFileSelect} className={css(style.hide)} />
            <label for="file" className={css(style.browseButton)} tabIndex={0}>
              Browse
            </label>
          </div>

          <p className={css(style.landingP)}>
            See the{' '}
            <a className={css(style.link)} href="https://github.com/jlfwong/speedscope#usage" target="_blank">
              documentation
            </a>{' '}
            for information about supported file formats, keyboard shortcuts, and how to navigate around the profile.
          </p>

          <p className={css(style.landingP)}>
            speedscope is open source. Please{' '}
            <a className={css(style.link)} target="_blank" href="https://github.com/jlfwong/speedscope/issues">
              report any issues on GitHub
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  renderError() {
    const style = this.getStyle()

    return (
      <div className={css(style.error)}>
        <div>Something went wrong.</div>
        <div>Check the JS console for more details.</div>
      </div>
    )
  }

  renderLoadingBar() {
    const style = this.getStyle()
    return <div className={css(style.loading)} />
  }

  renderContent() {
    const { viewMode, activeProfileState, error, loading, glCanvas } = this.props

    if (error) {
      return this.renderError()
    }

    if (loading) {
      return this.renderLoadingBar()
    }

    if (!activeProfileState || !glCanvas) {
      if (this.isEmbedded()) {
        return this.renderError()
      }
      return this.renderLanding()
    }

    switch (viewMode) {
      case ViewMode.CHRONO_FLAME_CHART: {
        if (!enableTimelineView) return <LeftHeavyFlamechartView activeProfileState={activeProfileState} glCanvas={glCanvas} />
        return <ChronoFlamechartView activeProfileState={activeProfileState} glCanvas={glCanvas} />
      }
      case ViewMode.LEFT_HEAVY_FLAME_GRAPH: {
        return <LeftHeavyFlamechartView activeProfileState={activeProfileState} glCanvas={glCanvas} />
      }
      case ViewMode.SANDWICH_VIEW: {
        return <SandwichViewContainer activeProfileState={activeProfileState} glCanvas={glCanvas} />
      }
    }
  }

  render() {
    const style = this.getStyle()
    const dragActive = !this.isEmbedded() && this.props.dragActive
    return (
      <div
        onDrop={this.onDrop}
        onDragOver={this.onDragOver}
        onDragLeave={this.onDragLeave}
        className={css(style.root, dragActive && style.dragTargetRoot)}
      >
        <GLCanvas setGLCanvas={this.props.setGLCanvas} canvasContext={this.props.canvasContext} theme={this.props.theme} />
        <Toolbar browseForFile={this.browseForFile} {...(this.props as ApplicationProps)} />
        <div className={css(style.contentContainer)}>{this.renderContent()}</div>
        {dragActive && <div className={css(style.dragTarget)} />}
      </div>
    )
  }
}

const getStyle = withTheme(theme =>
  StyleSheet.create({
    glCanvasView: {
      position: 'absolute',
      width: '100vw',
      height: '100vh',
      zIndex: -1,
      pointerEvents: 'none',
    },
    error: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    },
    loading: {
      height: 3,
      marginBottom: -3,
      background: theme.selectionPrimaryColor,
      transformOrigin: '0% 50%',
      animationName: [
        {
          from: {
            transform: `scaleX(0)`,
          },
          to: {
            transform: `scaleX(1)`,
          },
        },
      ],
      animationTimingFunction: 'cubic-bezier(0, 1, 0, 1)',
      animationDuration: '30s',
    },
    root: {
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      fontFamily: FontFamily.MONOSPACE,
      lineHeight: '20px',
      color: theme.fgPrimaryColor,
    },
    dragTargetRoot: {
      cursor: 'copy',
    },
    dragTarget: {
      boxSizing: 'border-box',
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: `5px dashed ${theme.selectionPrimaryColor}`,
      pointerEvents: 'none',
    },
    contentContainer: {
      position: 'relative',
      display: 'flex',
      overflow: 'hidden',
      flexDirection: 'column',
      flex: 1,
    },
    landingContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    landingMessage: {
      maxWidth: 600,
    },
    landingP: {
      marginBottom: 16,
    },
    hide: {
      display: 'none',
    },
    browseButtonContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    browseButton: {
      marginBottom: 16,
      height: 72,
      flex: 1,
      maxWidth: 256,
      textAlign: 'center',
      fontSize: FontSize.BIG_BUTTON,
      lineHeight: '72px',
      background: theme.selectionPrimaryColor,
      color: theme.altFgPrimaryColor,
      transition: `all ${Duration.HOVER_CHANGE} ease-in`,
      ':hover': {
        background: theme.selectionSecondaryColor,
      },
    },
    link: {
      color: theme.selectionPrimaryColor,
      cursor: 'pointer',
      textDecoration: 'none',
      transition: `all ${Duration.HOVER_CHANGE} ease-in`,
      ':hover': {
        color: theme.selectionSecondaryColor,
      },
    },
  }),
)
