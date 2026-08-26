export class AsyncStringQueue implements AsyncIterable<string> {
  private values: string[] = []
  private resolveNext: (() => void) | null = null
  private isDone = false

  push(value: string): void {
    this.values.push(value)
    this.wake()
  }

  done(): void {
    this.isDone = true
    this.wake()
  }

  async *[Symbol.asyncIterator](): AsyncIterator<string> {
    while (true) {
      if (this.values.length > 0) {
        yield this.values.shift() as string
        continue
      }

      if (this.isDone) {
        return
      }

      await new Promise<void>(resolve => {
        this.resolveNext = resolve
      })
    }
  }

  private wake(): void {
    if (this.resolveNext) {
      this.resolveNext()
      this.resolveNext = null
    }
  }
}

export function readLinesFromFile(file: File): AsyncIterable<string> {
  return readLinesFromStream(file.stream())
}

export async function* readLinesFromUrl(url: string): AsyncIterable<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }
  if (!response.body) {
    throw new Error(`No response body for ${url}`)
  }

  yield* readLinesFromStream(response.body)
}

export async function* readLinesFromStream(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const streamDecoderOptions = { stream: true }
  let bufferedText = ''

  try {
    for await (const { done, value } of readChunksFromReaderMaybeCompressed(reader)) {
      if (done) break

      const chunkText = decoder.decode(value, streamDecoderOptions)
      let lineStart = 0
      let newlineIndex = chunkText.indexOf('\n')
      if (newlineIndex === -1) {
        bufferedText += chunkText
        continue
      }

      yield bufferedText + chunkText.slice(0, newlineIndex)
      bufferedText = ''
      lineStart = newlineIndex + 1

      while (true) {
        newlineIndex = chunkText.indexOf('\n', lineStart)
        if (newlineIndex === -1) {
          break
        }

        yield chunkText.slice(lineStart, newlineIndex)
        lineStart = newlineIndex + 1
      }

      bufferedText = chunkText.slice(lineStart)
    }

    bufferedText += decoder.decode()
    if (bufferedText.length > 0) {
      yield bufferedText
    }
  } catch (error) {
    console.warn('Input ended unexpectedly; importing complete records only', error)
    return
  } finally {
    reader.releaseLock()
  }
}

async function* readChunksFromReader(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncIterable<ReadableStreamReadResult<Uint8Array>> {
  while (true) {
    const chunk = await reader.read()
    yield chunk
    if (chunk.done) {
      return
    }
  }
}

async function* readChunksFromReaderMaybeCompressed(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncIterable<ReadableStreamReadResult<Uint8Array>> {
  const firstChunk = await reader.read()
  if (firstChunk.done) {
    yield firstChunk
    return
  }

  const firstChunkValue = firstChunk.value
  const isGzip = firstChunkValue.length >= 2 && firstChunkValue[0] === 0x1f && firstChunkValue[1] === 0x8b
  if (isGzip && typeof DecompressionStream === 'undefined') {
    throw new Error('Gzip-compressed input is not supported in this browser')
  }
  if (!isGzip) {
    yield firstChunk
    yield* readChunksFromReader(reader)
    return
  }

  const compressedStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(firstChunkValue)

      for await (const { done, value } of readChunksFromReader(reader)) {
        if (done) {
          controller.close()
          return
        }

        controller.enqueue(value)
      }
    },
  })
  const decompressionStream = new DecompressionStream('gzip') as ReadableWritablePair<Uint8Array, Uint8Array>
  const decompressedReader = compressedStream.pipeThrough(decompressionStream).getReader()

  yield* readChunksFromReader(decompressedReader)
}

export async function* readObjectsFromLines(lines: AsyncIterable<string>): AsyncIterable<any> {
  const iterator = lines[Symbol.asyncIterator]()
  const first = await iterator.next()
  if (first.done) {
    return
  }

  try {
    yield JSON.parse(first.value)
  } catch {
    let contents = first.value
    while (true) {
      const next = await iterator.next()
      if (next.done) break
      contents += next.value
    }

    try {
      yield JSON.parse(contents)
    } catch {
      throw new Error('Input is not valid NDJSON or JSON')
    }
    return
  }

  while (true) {
    const next = await iterator.next()
    if (next.done) break
    try {
      yield JSON.parse(next.value)
    } catch {
      throw new Error('Input is not valid NDJSON')
    }
  }
}

export function readObjectsFromFile(file: File): AsyncIterable<any> {
  return readObjectsFromLines(readLinesFromFile(file))
}

export function readObjectsFromUrl(url: string): AsyncIterable<any> {
  return readObjectsFromLines(readLinesFromUrl(url))
}
