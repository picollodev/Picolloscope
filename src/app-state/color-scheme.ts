import {Atom} from '../lib/atom'
import {getURLParams, URLTheme} from '../lib/url-params'

export const enum ColorScheme {
  // Default: respect prefers-color-schema
  SYSTEM,

  // Use dark theme
  DARK,

  // use light theme
  LIGHT,
}

const localStorageKey = 'speedscope-color-scheme'

function getStoredPreference(): ColorScheme {
  const storedPreference = window.localStorage && window.localStorage[localStorageKey]
  if (storedPreference === 'DARK') {
    return ColorScheme.DARK
  } else if (storedPreference === 'LIGHT') {
    return ColorScheme.LIGHT
  } else {
    return ColorScheme.SYSTEM
  }
}

function getColorSchemeFromURLTheme(theme: URLTheme): ColorScheme {
  switch (theme) {
    case 'dark':
      return ColorScheme.DARK
    case 'light':
      return ColorScheme.LIGHT
    case 'system':
      return ColorScheme.SYSTEM
  }
}

function getInitialColorScheme(): ColorScheme {
  const urlParams = getURLParams()
  if (urlParams.theme) {
    return getColorSchemeFromURLTheme(urlParams.theme)
  }
  if (urlParams.embedded) {
    return ColorScheme.SYSTEM
  }
  return getStoredPreference()
}

function matchMediaDarkColorScheme(): MediaQueryList {
  return matchMedia('(prefers-color-scheme: dark)')
}

function nextColorScheme(scheme: ColorScheme): ColorScheme {
  const systemPrefersDarkMode = matchMediaDarkColorScheme().matches

  // We'll use a different cycling order for changing the color scheme depending
  // on what the *current* system preference is. This should guarantee that when
  // a user interacts with the color scheme toggle for the first time, it always
  // changes the color scheme.
  if (systemPrefersDarkMode) {
    switch (scheme) {
      case ColorScheme.SYSTEM: {
        return ColorScheme.LIGHT
      }
      case ColorScheme.LIGHT: {
        return ColorScheme.DARK
      }
      case ColorScheme.DARK: {
        return ColorScheme.SYSTEM
      }
    }
  } else {
    switch (scheme) {
      case ColorScheme.SYSTEM: {
        return ColorScheme.DARK
      }
      case ColorScheme.DARK: {
        return ColorScheme.LIGHT
      }
      case ColorScheme.LIGHT: {
        return ColorScheme.SYSTEM
      }
    }
  }
}

class ColorSchemeAtom extends Atom<ColorScheme> {
  cycleToNextColorScheme = () => {
    this.set(nextColorScheme(this.get()))
  }
}

export const colorSchemeAtom = new ColorSchemeAtom(getInitialColorScheme(), 'colorScheme')

colorSchemeAtom.subscribe(() => {
  const value = colorSchemeAtom.get()

  switch (value) {
    case ColorScheme.DARK: {
      window.localStorage[localStorageKey] = 'DARK'
      break
    }
    case ColorScheme.LIGHT: {
      window.localStorage[localStorageKey] = 'LIGHT'
      break
    }
    case ColorScheme.SYSTEM: {
      delete window.localStorage[localStorageKey]
      break
    }
    default: {
      const _exhaustiveCheck: never = value
      return _exhaustiveCheck
    }
  }
  return value
})
