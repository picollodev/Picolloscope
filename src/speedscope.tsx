import {h, render} from 'preact'
import {ApplicationContainer} from './views/application-container'
import {ThemeProvider} from './views/themes/theme'

declare const __SPEEDSCOPE_VERSION__: string

console.log(`speedscope v${__SPEEDSCOPE_VERSION__}`)

/*
TODO(jlfwong): Fix this
declare const module: any
if (module.hot) {
  module.hot.dispose(() => {
    // Force the old component go through teardown steps
    render(<div />, document.body, document.body.lastElementChild || undefined)
  })
  module.hot.accept()
}
*/

render(
  <ThemeProvider>
    <ApplicationContainer />
  </ThemeProvider>,
  document.body,
  document.body.lastElementChild || undefined,
)
