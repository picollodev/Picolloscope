import {
  CompressionStream as NodeCompressionStream,
  DecompressionStream as NodeDecompressionStream,
  ReadableStream as NodeReadableStream,
} from 'stream/web'
import { AsyncStringQueue, readLinesFromStream, readObjectsFromLines } from './reader'

Object.assign(globalThis, {
  CompressionStream: NodeCompressionStream,
  DecompressionStream: NodeDecompressionStream,
  ReadableStream: NodeReadableStream,
})

async function collectValues(lines: AsyncIterable<string>): Promise<number[]> {
  const values: number[] = []
  for await (const line of lines) {
    values.push(JSON.parse(line).value)
  }
  return values
}

async function collectObjects(lines: AsyncIterable<string>): Promise<any[]> {
  const values: any[] = []
  for await (const value of readObjectsFromLines(lines)) {
    values.push(value)
  }
  return values
}

async function* asyncLines(lines: string[]): AsyncIterable<string> {
  for (let line of lines) {
    yield line
  }
}

function ndjsonPayload(lineCount: number, trailingLineEnd: boolean): string {
  const lines: string[] = []
  for (let i = 1; i <= lineCount; i++) {
    lines.push(JSON.stringify({ value: i }))
  }
  return lines.join('\n') + (trailingLineEnd ? '\n' : '')
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const input = streamFromBytes(bytes)
  const compressionStream = new NodeCompressionStream('gzip') as ReadableWritablePair<Uint8Array, Uint8Array>
  const stream = input.pipeThrough(compressionStream)
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const compressedBytes = new Uint8Array(length)
  let offset = 0
  for (let chunk of chunks) {
    compressedBytes.set(chunk, offset)
    offset += chunk.length
  }
  return compressedBytes
}

function streamFromBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new NodeReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  }) as unknown as ReadableStream<Uint8Array>
}

async function expectLines(payload: string, compressed: boolean, expectedValues: number[]): Promise<void> {
  const encodedPayload = new TextEncoder().encode(payload)
  const streamPayload = compressed ? await gzip(encodedPayload) : encodedPayload

  expect(await collectValues(readLinesFromStream(streamFromBytes(streamPayload)))).toEqual(expectedValues)
}

test('linesFromStream reads plain NDJSON lines', async () => {
  await expectLines(ndjsonPayload(1, false), false, [1])
  await expectLines(ndjsonPayload(1, true), false, [1])
  await expectLines(ndjsonPayload(3, false), false, [1, 2, 3])
  await expectLines(ndjsonPayload(3, true), false, [1, 2, 3])
})

test('linesFromStream reads gzip NDJSON lines', async () => {
  await expectLines(ndjsonPayload(1, false), true, [1])
  await expectLines(ndjsonPayload(1, true), true, [1])
  await expectLines(ndjsonPayload(3, false), true, [1, 2, 3])
  await expectLines(ndjsonPayload(3, true), true, [1, 2, 3])
})

test('AsyncStringQueue yields buffered values', async () => {
  const queue = new AsyncStringQueue()
  queue.push(JSON.stringify({ value: 1 }))
  queue.push(JSON.stringify({ value: 2 }))
  queue.push(JSON.stringify({ value: 3 }))
  queue.done()

  expect(await collectValues(queue)).toEqual([1, 2, 3])
})

test('AsyncStringQueue waits for pushed values', async () => {
  const queue = new AsyncStringQueue()
  const valuesPromise = collectValues(queue)

  queue.push(JSON.stringify({ value: 1 }))
  queue.push(JSON.stringify({ value: 2 }))
  queue.push(JSON.stringify({ value: 3 }))
  queue.done()

  expect(await valuesPromise).toEqual([1, 2, 3])
})

test('readObjectsFromLines reads pretty-printed JSON', async () => {
  const lines = [
    '{',
    '  "name": "profile",',
    '  "profiles": [',
    '    { "value": 1 },',
    '    { "value": 2 }',
    '  ]',
    '}',
  ]

  expect(await collectObjects(asyncLines(lines))).toEqual([
    {
      name: 'profile',
      profiles: [
        { value: 1 },
        { value: 2 },
      ],
    },
  ])
})
