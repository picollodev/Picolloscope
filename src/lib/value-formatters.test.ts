import {TimeFormatter, ByteFormatter} from './value-formatters'

describe('TimeFormatter', () => {
  test('input units milliseconds', () => {
    const f = new TimeFormatter('milliseconds')
    expect(f.format(0.00004)).toEqual('40n')
    expect(f.format(0.04)).toEqual('40µ')
    expect(f.format(3)).toEqual('3m')
    expect(f.format(99)).toEqual('99m')
    expect(f.format(100)).toEqual('0.10s')
    expect(f.format(2070)).toEqual('2.07s')
    expect(f.format(150000)).toEqual('150.00s')
    expect(f.format(1203123)).toEqual('1203.12s')
  })

  test('input units seconds', () => {
    const f = new TimeFormatter('seconds')
    expect(f.format(0.00004)).toEqual('40µ')
    expect(f.format(0.003)).toEqual('3m')
    expect(f.format(0.099)).toEqual('99m')
    expect(f.format(0.1)).toEqual('0.10s')
    expect(f.format(2.07)).toEqual('2.07s')
    expect(f.format(150)).toEqual('150.00s')
    expect(f.format(1203.123)).toEqual('1203.12s')
  })
})

test('ByteFormatter', () => {
  const f = new ByteFormatter()
  expect(f.format(100)).toEqual('100 B')
  expect(f.format(1024)).toEqual('1.00 KB')
  expect(f.format(3.5 * 1024 * 1024)).toEqual('3.50 MB')
  expect(f.format(4.32 * 1024 * 1024 * 1024)).toEqual('4.32 GB')
})
