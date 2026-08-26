import {ViewMode} from './view-mode'
import {getURLParams} from './url-params'

test('getURLParams', () => {
  expect(getURLParams('')).toEqual({})
  expect(getURLParams('?profileURL=https%3A%2F%2Fexample.com%2Fprofile.json')).toEqual({
    profileURL: 'https://example.com/profile.json',
  })

  expect(
    getURLParams(
      '?profileURL=https%3A%2F%2Fexample.com%2Fprofile.json%3Fone%3D1%26two%3D2%23section%3Da%3Db&title=Query%20Title&view=left-heavy&embedded',
    ),
  ).toEqual({
    profileURL: 'https://example.com/profile.json?one=1&two=2#section=a=b',
    title: 'Query Title',
    viewMode: ViewMode.LEFT_HEAVY_FLAME_GRAPH,
    embedded: true,
  })

  expect(getURLParams('?theme=dark')).toEqual({theme: 'dark'})
  expect(getURLParams('?theme=light')).toEqual({theme: 'light'})
  expect(getURLParams('?theme=system')).toEqual({theme: 'system'})
  expect(getURLParams('?theme=invalid')).toEqual({})

  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  expect(getURLParams('?view=invalid&embedded=false')).toEqual({
    embedded: true,
  })
  expect(consoleError).toHaveBeenCalledWith('Ignoring invalid view specifier: invalid')
  consoleError.mockRestore()

  expect(() => getURLParams('?title=%E0%A4%A')).not.toThrow()
})
