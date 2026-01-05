/**
 * Video Compression Utility
 *
 * 브라우저 내에서 비디오를 압축하는 유틸리티입니다.
 * WebCodecs API를 우선 사용하고, 지원되지 않는 경우 Canvas 기반 폴백을 사용합니다.
 */

export interface CompressionOptions {
  /** 최대 해상도 (기본값: 1080) */
  maxResolution?: number
  /** 목표 비트레이트 (bps, 기본값: 2_000_000 = 2Mbps) */
  targetBitrate?: number
  /** 프레임 레이트 (기본값: 30) */
  frameRate?: number
  /** 압축 품질 프리셋 */
  quality?: 'low' | 'medium' | 'high'
}

export interface CompressionProgress {
  /** 현재 진행률 (0-100) */
  percent: number
  /** 현재 상태 */
  stage: 'analyzing' | 'compressing' | 'finalizing'
  /** 처리된 프레임 수 */
  processedFrames?: number
  /** 총 프레임 수 */
  totalFrames?: number
  /** 예상 출력 크기 (bytes) */
  estimatedSize?: number
}

export interface CompressionResult {
  /** 압축된 비디오 Blob */
  blob: Blob
  /** 원본 크기 (bytes) */
  originalSize: number
  /** 압축 후 크기 (bytes) */
  compressedSize: number
  /** 압축률 (%) */
  compressionRatio: number
  /** 출력 해상도 */
  resolution: { width: number; height: number }
  /** 소요 시간 (ms) */
  duration: number
}

/** 품질 프리셋에 따른 기본 비트레이트 */
const QUALITY_BITRATES: Record<string, number> = {
  low: 1_000_000, // 1 Mbps
  medium: 2_000_000, // 2 Mbps
  high: 4_000_000, // 4 Mbps
}

/**
 * WebCodecs API 지원 여부 확인
 */
export function isWebCodecsSupported(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined'
  )
}

/**
 * 비디오 메타데이터 분석
 */
export async function analyzeVideo(
  file: File | Blob
): Promise<{
  duration: number
  width: number
  height: number
  frameCount: number
  estimatedBitrate: number
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true

    const url = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      const duration = video.duration
      const width = video.videoWidth
      const height = video.videoHeight
      const estimatedBitrate = (file.size * 8) / duration // bps
      const frameCount = Math.ceil(duration * 30) // 30fps 가정

      URL.revokeObjectURL(url)
      resolve({
        duration,
        width,
        height,
        frameCount,
        estimatedBitrate,
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('비디오 분석 실패: 지원되지 않는 형식입니다.'))
    }

    video.src = url
  })
}

/**
 * 압축이 필요한지 판단
 */
export async function needsCompression(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<boolean> {
  const { maxResolution = 1080, targetBitrate } = options

  try {
    const metadata = await analyzeVideo(file)
    const effectiveBitrate = targetBitrate || QUALITY_BITRATES['medium']

    // 해상도가 최대 해상도보다 크거나 비트레이트가 목표보다 높으면 압축 필요
    const resolutionExceeds =
      metadata.width > maxResolution || metadata.height > maxResolution
    const bitrateExceeds = metadata.estimatedBitrate > effectiveBitrate * 1.2

    return resolutionExceeds || bitrateExceeds
  } catch {
    return false
  }
}

/**
 * 출력 해상도 계산
 */
function calculateOutputResolution(
  width: number,
  height: number,
  maxResolution: number
): { width: number; height: number } {
  const aspectRatio = width / height

  if (width <= maxResolution && height <= maxResolution) {
    // 이미 최대 해상도 이하인 경우 그대로 반환 (단, 2의 배수로 조정)
    return {
      width: Math.floor(width / 2) * 2,
      height: Math.floor(height / 2) * 2,
    }
  }

  let newWidth: number
  let newHeight: number

  if (aspectRatio >= 1) {
    // 가로가 더 긴 경우
    newWidth = maxResolution
    newHeight = Math.round(maxResolution / aspectRatio)
  } else {
    // 세로가 더 긴 경우
    newHeight = maxResolution
    newWidth = Math.round(maxResolution * aspectRatio)
  }

  // 2의 배수로 조정 (코덱 요구사항)
  return {
    width: Math.floor(newWidth / 2) * 2,
    height: Math.floor(newHeight / 2) * 2,
  }
}

/**
 * Canvas 기반 비디오 압축 (WebCodecs 폴백)
 * MediaRecorder API를 사용하여 비디오를 재인코딩합니다.
 */
async function compressWithCanvas(
  file: File | Blob,
  options: CompressionOptions,
  onProgress?: (progress: CompressionProgress) => void
): Promise<CompressionResult> {
  const startTime = Date.now()
  const metadata = await analyzeVideo(file)

  const { maxResolution = 1080, targetBitrate, quality = 'medium' } = options
  const effectiveBitrate = targetBitrate || QUALITY_BITRATES[quality]

  const outputRes = calculateOutputResolution(
    metadata.width,
    metadata.height,
    maxResolution
  )

  onProgress?.({
    percent: 5,
    stage: 'analyzing',
  })

  // 비디오 엘리먼트 생성
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true

  const videoUrl = URL.createObjectURL(file)
  video.src = videoUrl

  await new Promise<void>((resolve, reject) => {
    video.oncanplaythrough = () => resolve()
    video.onerror = () => reject(new Error('비디오 로드 실패'))
    video.load()
  })

  // Canvas 설정
  const canvas = document.createElement('canvas')
  canvas.width = outputRes.width
  canvas.height = outputRes.height
  const ctx = canvas.getContext('2d')!

  // MediaRecorder 설정
  const stream = canvas.captureStream(30)
  const chunks: Blob[] = []

  // 지원되는 MIME 타입 확인
  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]

  let selectedMimeType = 'video/webm'
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      selectedMimeType = mimeType
      break
    }
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: selectedMimeType,
    videoBitsPerSecond: effectiveBitrate,
  })

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data)
    }
  }

  const recordingComplete = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: selectedMimeType })
      resolve(blob)
    }
  })

  // 녹화 시작
  recorder.start(100) // 100ms 간격으로 데이터 수집

  onProgress?.({
    percent: 10,
    stage: 'compressing',
    processedFrames: 0,
    totalFrames: metadata.frameCount,
  })

  // 프레임 단위 처리
  const frameRate = 30
  const frameDuration = 1 / frameRate
  let currentTime = 0
  let processedFrames = 0

  while (currentTime < metadata.duration) {
    video.currentTime = currentTime
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
    })

    // Canvas에 프레임 그리기
    ctx.drawImage(video, 0, 0, outputRes.width, outputRes.height)

    processedFrames++
    currentTime += frameDuration

    // 진행률 업데이트 (10프레임마다)
    if (processedFrames % 10 === 0) {
      const percent = Math.min(
        90,
        10 + (processedFrames / metadata.frameCount) * 80
      )
      onProgress?.({
        percent,
        stage: 'compressing',
        processedFrames,
        totalFrames: metadata.frameCount,
      })
    }

    // UI 응답성을 위한 yield
    if (processedFrames % 30 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  // 녹화 종료
  recorder.stop()
  stream.getTracks().forEach((track) => track.stop())

  onProgress?.({
    percent: 95,
    stage: 'finalizing',
  })

  const compressedBlob = await recordingComplete

  URL.revokeObjectURL(videoUrl)

  onProgress?.({
    percent: 100,
    stage: 'finalizing',
  })

  const duration = Date.now() - startTime

  return {
    blob: compressedBlob,
    originalSize: file.size,
    compressedSize: compressedBlob.size,
    compressionRatio: Math.round(
      (1 - compressedBlob.size / file.size) * 100
    ),
    resolution: outputRes,
    duration,
  }
}

/**
 * WebCodecs 기반 비디오 압축
 * 더 효율적이고 세밀한 제어가 가능합니다.
 */
async function compressWithWebCodecs(
  file: File | Blob,
  options: CompressionOptions,
  onProgress?: (progress: CompressionProgress) => void
): Promise<CompressionResult> {
  const startTime = Date.now()
  const metadata = await analyzeVideo(file)

  const {
    maxResolution = 1080,
    targetBitrate,
    quality = 'medium',
    frameRate = 30,
  } = options
  const effectiveBitrate = targetBitrate || QUALITY_BITRATES[quality]

  const outputRes = calculateOutputResolution(
    metadata.width,
    metadata.height,
    maxResolution
  )

  onProgress?.({
    percent: 5,
    stage: 'analyzing',
  })

  // 비디오 로드
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true

  const videoUrl = URL.createObjectURL(file)
  video.src = videoUrl

  await new Promise<void>((resolve, reject) => {
    video.oncanplaythrough = () => resolve()
    video.onerror = () => reject(new Error('비디오 로드 실패'))
    video.load()
  })

  // Canvas 설정 (프레임 추출용)
  const canvas = document.createElement('canvas')
  canvas.width = outputRes.width
  canvas.height = outputRes.height
  const ctx = canvas.getContext('2d')!

  // 인코딩된 청크 저장
  const encodedChunks: { data: Uint8Array; type: string; timestamp: number }[] =
    []

  // VideoEncoder 설정
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      const chunkData = new Uint8Array(chunk.byteLength)
      chunk.copyTo(chunkData)
      encodedChunks.push({
        data: chunkData,
        type: chunk.type,
        timestamp: chunk.timestamp,
      })
    },
    error: (e) => {
      console.error('Encoder error:', e)
    },
  })

  encoder.configure({
    codec: 'vp8', // VP8은 널리 지원됨
    width: outputRes.width,
    height: outputRes.height,
    bitrate: effectiveBitrate,
    framerate: frameRate,
  })

  onProgress?.({
    percent: 10,
    stage: 'compressing',
    processedFrames: 0,
    totalFrames: metadata.frameCount,
  })

  // 프레임 추출 및 인코딩
  const frameDuration = 1 / frameRate
  let currentTime = 0
  let processedFrames = 0
  const totalFrames = Math.ceil(metadata.duration * frameRate)

  while (currentTime < metadata.duration) {
    video.currentTime = currentTime
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
    })

    // Canvas에 프레임 그리기
    ctx.drawImage(video, 0, 0, outputRes.width, outputRes.height)

    // ImageBitmap 생성
    const bitmap = await createImageBitmap(canvas)

    // VideoFrame 생성
    const frame = new VideoFrame(bitmap, {
      timestamp: Math.round(currentTime * 1_000_000), // microseconds
      duration: Math.round(frameDuration * 1_000_000),
    })

    // 인코딩
    const isKeyFrame = processedFrames % 30 === 0
    encoder.encode(frame, { keyFrame: isKeyFrame })

    frame.close()
    bitmap.close()

    processedFrames++
    currentTime += frameDuration

    // 진행률 업데이트
    if (processedFrames % 10 === 0) {
      const percent = Math.min(90, 10 + (processedFrames / totalFrames) * 80)
      onProgress?.({
        percent,
        stage: 'compressing',
        processedFrames,
        totalFrames,
      })
    }

    // UI 응답성을 위한 yield
    if (processedFrames % 30 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  // 인코딩 완료 대기
  await encoder.flush()
  encoder.close()

  onProgress?.({
    percent: 95,
    stage: 'finalizing',
  })

  // WebM 컨테이너 생성 (간단한 구현)
  const compressedBlob = createWebMBlob(encodedChunks, outputRes, frameRate)

  URL.revokeObjectURL(videoUrl)

  onProgress?.({
    percent: 100,
    stage: 'finalizing',
  })

  const duration = Date.now() - startTime

  return {
    blob: compressedBlob,
    originalSize: file.size,
    compressedSize: compressedBlob.size,
    compressionRatio: Math.round((1 - compressedBlob.size / file.size) * 100),
    resolution: outputRes,
    duration,
  }
}

/**
 * 간단한 WebM 컨테이너 생성
 * 참고: 실제 프로덕션에서는 muxer 라이브러리 사용 권장
 */
function createWebMBlob(
  chunks: { data: Uint8Array; type: string; timestamp: number }[],
  resolution: { width: number; height: number },
  frameRate: number
): Blob {
  // 간단한 구현: 청크들을 바이너리로 결합
  // 실제로는 WebM 컨테이너 포맷에 맞게 muxing 필요
  // 여기서는 MediaRecorder 폴백을 사용하므로 이 함수는 fallback용
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.data.length, 0)
  const combined = new Uint8Array(totalSize)

  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk.data, offset)
    offset += chunk.data.length
  }

  return new Blob([combined], { type: 'video/webm' })
}

/**
 * 비디오 압축 메인 함수
 */
export async function compressVideo(
  file: File | Blob,
  options: CompressionOptions = {},
  onProgress?: (progress: CompressionProgress) => void
): Promise<CompressionResult> {
  // 압축 필요 여부 확인
  const shouldCompress = await needsCompression(file, options)

  if (!shouldCompress) {
    // 압축 불필요한 경우 원본 반환
    const metadata = await analyzeVideo(file)
    return {
      blob: file instanceof Blob ? file : new Blob([file]),
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 0,
      resolution: { width: metadata.width, height: metadata.height },
      duration: 0,
    }
  }

  // Canvas 기반 압축 사용 (더 안정적)
  // WebCodecs는 muxer 라이브러리 없이는 완전한 비디오 파일 생성이 어려움
  return compressWithCanvas(file, options, onProgress)
}

/**
 * 여러 비디오 일괄 압축
 */
export async function compressVideos(
  files: Array<{ id: string; blob: Blob }>,
  options: CompressionOptions = {},
  onProgress?: (fileId: string, progress: CompressionProgress) => void
): Promise<Map<string, CompressionResult>> {
  const results = new Map<string, CompressionResult>()

  for (const file of files) {
    const result = await compressVideo(file.blob, options, (progress) => {
      onProgress?.(file.id, progress)
    })
    results.set(file.id, result)
  }

  return results
}

/**
 * 압축 가능 여부 확인 (브라우저 지원)
 */
export function canCompress(): boolean {
  // MediaRecorder 지원 여부 확인 (Canvas 기반 압축에 필요)
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream !== 'undefined'
  )
}
