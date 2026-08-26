import {InputFormat} from '../input-format-spec'
import {CallTreeNode, Profile} from '.'

const metadata: InputFormat.Metadata = {
  frames: [
    {name: 'a', file: '0.ts', line: 0},
    {name: 'b', file: '1.ts', line: 1},
    {name: 'c', file: '2.ts', line: 2},
    {name: 'd', file: '3.ts', line: 3},
    {name: 'e', file: '4.ts', line: 4},
  ],
}

const fa = 0
const fb = 1
const fc = 2
const fd = 3
const fe = 4

function createProfile() {
  return new Profile('profile', metadata)
}

function appendSampledProfile(profile: Profile, samples: InputFormat.SampledStack[], weights: number[] | null = [1]) {
  profile.appendInputChunk({
    type: InputFormat.ProfileType.SAMPLED,
    name: 'profile',
    tid: 'profile',
    unit: 'none',
    startValue: 0,
    endValue: 0,
    samples,
    weights,
  })
}

function appendEventedProfile(profile: Profile, events: InputFormat.EventedProfile['events']) {
  profile.appendInputChunk({
    type: InputFormat.ProfileType.EVENTED,
    name: 'profile',
    tid: 'profile',
    unit: 'none',
    startValue: 0,
    endValue: 0,
    events,
  })
}

function toStackList(profile: Profile, grouped: boolean): string[] {
  const stackList: string[] = []
  const curStack: string[] = []
  let lastValue = 0

  function maybeEmit(value: number) {
    if (lastValue != value) {
      stackList.push(curStack.join(';') + ` ${profile.formatValue(value - lastValue)}`)
      lastValue = value
    }
  }

  function openFrame(node: CallTreeNode, value: number) {
    maybeEmit(value)
    curStack.push(node.frame.name)
  }

  function closeFrame(node: CallTreeNode, value: number) {
    maybeEmit(value)
    curStack.pop()
  }

  if (grouped)
    profile.forEachCallGrouped(openFrame, closeFrame)
  else
    profile.forEachCall(openFrame, closeFrame)

  return stackList
}

function toTreeString(profile: Profile, grouped: boolean): string {
  function visit(node: CallTreeNode): string[] {
    const childLines = node.children.flatMap(child => visit(child)).map(line => `  ${line}`)
    const nodeStr = `${node.frame.key}:${node.selfWeight}:${node.totalWeight}`

    if (childLines.length > 0)
      return [`(${nodeStr}`].concat(childLines).concat(')')
    else
      return [`(${nodeStr})`]
  }

  return visit(grouped ? profile.groupedCalltreeRoot : profile.appendOrderCalltreeRoot).join('\n')
}

test('sampled profile builds grouped data without ordered timeline', () => {
  const profile = createProfile()
  const samples = [
    [fa],
    [fa, fb],
    [fa, fb],
    [fa, fb, fd],
    [fa, fb, fc],
    [],
    [fa],
    [fa, fb],
    [fa, fb, fb],
    [fa, fb, fe],
    [fa],
  ]

  appendSampledProfile(profile, samples)

  expect(profile.getTotalWeight()).toBe(10)
  expect(profile.getTotalNonIdleWeight()).toBe(10)
  expect(profile.samples).toHaveLength(0)
  expect(profile.weights).toHaveLength(0)
  expect(profile.appendOrderCalltreeRoot.children).toHaveLength(0)

  expect(toStackList(profile, true)).toEqual([
    'a;b;d 1',
    'a;b;c 1',
    'a;b;b 1',
    'a;b;e 1',
    'a;b 3',
    'a 3',
  ])
})

test('sampled profile separates non-contiguous grouped nodes', () => {
  const profile = createProfile()

  appendSampledProfile(profile, [
    [fa, fb, fc],
    [fa, fb],
    [fa],
    [fa, fb],
    [fa, fb, fc],
  ])

  expect(toTreeString(profile, true)).toMatchInlineSnapshot(`
"(0:0:0
  (0:1:5
    (1:2:4
      (2:2:2)
    )
  )
)"
`)
})

test('evented profile keeps ordered and grouped data', () => {
  const profile = createProfile()

  appendEventedProfile(profile, [
    {type: InputFormat.EventType.OPEN_FRAME, frame: fa, at: 0},
    {type: InputFormat.EventType.OPEN_FRAME, frame: fb, at: 1},
    {type: InputFormat.EventType.OPEN_FRAME, frame: fd, at: 3},
    {type: InputFormat.EventType.CLOSE_FRAME, frame: fd, at: 4},
    {type: InputFormat.EventType.OPEN_FRAME, frame: fc, at: 4},
    {type: InputFormat.EventType.CLOSE_FRAME, frame: fc, at: 5},
    {type: InputFormat.EventType.CLOSE_FRAME, frame: fb, at: 5},
    {type: InputFormat.EventType.CLOSE_FRAME, frame: fa, at: 5},
    {type: InputFormat.EventType.OPEN_FRAME, frame: fa, at: 6},
    {type: InputFormat.EventType.OPEN_FRAME, frame: fb, at: 7},
    {type: InputFormat.EventType.OPEN_FRAME, frame: fb, at: 8},
    {type: InputFormat.EventType.CLOSE_FRAME, frame: fb, at: 9},
    {type: InputFormat.EventType.OPEN_FRAME, frame: fe, at: 9},
    {type: InputFormat.EventType.CLOSE_FRAME, frame: fe, at: 10},
    {type: InputFormat.EventType.CLOSE_FRAME, frame: fb, at: 10},
    {type: InputFormat.EventType.CLOSE_FRAME, frame: fa, at: 11},
  ])

  expect(profile.getTotalWeight()).toBe(11)
  expect(profile.getTotalNonIdleWeight()).toBe(10)
  expect(toStackList(profile, false)).toEqual([
    'a 1',
    'a;b 2',
    'a;b;d 1',
    'a;b;c 1',
    ' 1',
    'a 1',
    'a;b 1',
    'a;b;b 1',
    'a;b;e 1',
    'a 1',
  ])
  expect(toStackList(profile, true)).toEqual([
    'a;b;d 1',
    'a;b;c 1',
    'a;b;b 1',
    'a;b;e 1',
    'a;b 3',
    'a 3',
  ])
})

test('getInvertedProfileForCallersOf uses grouped nodes', () => {
  const profile = createProfile()
  appendSampledProfile(profile, [
    [fb],
    [fa, fb],
    [fa, fb, fc],
    [fa],
    [fa, fb, fd],
    [fa],
    [fd, fb],
  ])

  const inverted = profile.getInvertedProfileForCallersOf(profile.getOrCreateProfileFrame(fb))

  expect(toStackList(inverted, true)).toEqual([
    'b;a 3',
    'b;d 1',
    'b 1',
  ])
})

test('getProfileForCalleesOf uses grouped nodes', () => {
  const profile = createProfile()
  appendSampledProfile(profile, [
    [fb],
    [fa, fb],
    [fa, fb, fc],
    [fa],
    [fa, fb, fd],
    [fa],
    [fd, fb],
  ])

  const callees = profile.getProfileForCalleesOf(profile.getOrCreateProfileFrame(fb))

  expect(toStackList(callees, true)).toEqual([
    'b;c 1',
    'b;d 1',
    'b 3',
  ])
})
