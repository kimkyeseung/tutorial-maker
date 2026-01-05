import '@testing-library/jest-dom'

// Mock for WebCodecs API (not available in jsdom)
class MockVideoEncoder {
  private callback: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void
  private errorCallback: (error: DOMException) => void
  private _state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured'

  constructor(init: {
    output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void
    error: (error: DOMException) => void
  }) {
    this.callback = init.output
    this.errorCallback = init.error
  }

  get state() {
    return this._state
  }

  configure(config: VideoEncoderConfig) {
    this._state = 'configured'
  }

  encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions) {
    // Simulate encoding by creating a mock chunk
    const mockChunk = {
      type: 'key',
      timestamp: frame.timestamp || 0,
      duration: frame.duration || 0,
      byteLength: 1000,
      copyTo: (destination: ArrayBuffer) => {
        new Uint8Array(destination).fill(0)
      },
    } as unknown as EncodedVideoChunk

    setTimeout(() => this.callback(mockChunk), 0)
    frame.close()
  }

  flush(): Promise<void> {
    return Promise.resolve()
  }

  close() {
    this._state = 'closed'
  }

  reset() {
    this._state = 'unconfigured'
  }
}

class MockVideoDecoder {
  private callback: (frame: VideoFrame) => void
  private errorCallback: (error: DOMException) => void
  private _state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured'

  constructor(init: {
    output: (frame: VideoFrame) => void
    error: (error: DOMException) => void
  }) {
    this.callback = init.output
    this.errorCallback = init.error
  }

  get state() {
    return this._state
  }

  configure(config: VideoDecoderConfig) {
    this._state = 'configured'
  }

  decode(chunk: EncodedVideoChunk) {
    // Create a mock frame
    const mockFrame = {
      timestamp: chunk.timestamp,
      duration: chunk.duration || 33333,
      codedWidth: 1920,
      codedHeight: 1080,
      displayWidth: 1920,
      displayHeight: 1080,
      close: () => {},
    } as unknown as VideoFrame

    setTimeout(() => this.callback(mockFrame), 0)
  }

  flush(): Promise<void> {
    return Promise.resolve()
  }

  close() {
    this._state = 'closed'
  }

  reset() {
    this._state = 'unconfigured'
  }
}

// Mock VideoFrame
class MockVideoFrame {
  timestamp: number
  duration: number
  codedWidth: number
  codedHeight: number
  displayWidth: number
  displayHeight: number

  constructor(
    source: HTMLVideoElement | ImageBitmap,
    init?: { timestamp?: number; duration?: number }
  ) {
    this.timestamp = init?.timestamp || 0
    this.duration = init?.duration || 33333
    this.codedWidth = 1920
    this.codedHeight = 1080
    this.displayWidth = 1920
    this.displayHeight = 1080
  }

  close() {}
}

// Assign mocks to global
Object.assign(globalThis, {
  VideoEncoder: MockVideoEncoder,
  VideoDecoder: MockVideoDecoder,
  VideoFrame: MockVideoFrame,
})

// Mock URL.createObjectURL and URL.revokeObjectURL
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = (blob: Blob) => `blob:mock-${Math.random()}`
}

if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = () => {}
}
