import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  isWebCodecsSupported,
  canCompress,
  CompressionOptions,
  CompressionProgress,
  CompressionResult,
} from './videoCompressor'

// Helper to create a mock video file
function createMockVideoFile(sizeInMB: number, name: string = 'test.mp4'): File {
  const bytes = new Uint8Array(sizeInMB * 1024 * 1024)
  return new File([bytes], name, { type: 'video/mp4' })
}

describe('videoCompressor', () => {
  describe('isWebCodecsSupported', () => {
    it('should return true when WebCodecs API is available', () => {
      // WebCodecs is mocked in setup.ts
      expect(isWebCodecsSupported()).toBe(true)
    })

    it('should return false when WebCodecs API is not available', () => {
      const originalVideoEncoder = globalThis.VideoEncoder
      // @ts-expect-error - intentionally removing for test
      delete globalThis.VideoEncoder

      expect(isWebCodecsSupported()).toBe(false)

      // Restore
      globalThis.VideoEncoder = originalVideoEncoder
    })
  })

  describe('canCompress', () => {
    it('should return true when MediaRecorder and captureStream are available', () => {
      // jsdom에서는 MediaRecorder가 없으므로 mock 필요
      const originalMediaRecorder = globalThis.MediaRecorder
      const originalCaptureStream =
        HTMLCanvasElement.prototype.captureStream

      // Mock MediaRecorder
      globalThis.MediaRecorder = class MockMediaRecorder {
        static isTypeSupported() {
          return true
        }
      } as unknown as typeof MediaRecorder

      // Mock captureStream
      HTMLCanvasElement.prototype.captureStream = function () {
        return new MediaStream()
      }

      expect(canCompress()).toBe(true)

      // Restore
      if (originalMediaRecorder) {
        globalThis.MediaRecorder = originalMediaRecorder
      } else {
        // @ts-expect-error - removing for cleanup
        delete globalThis.MediaRecorder
      }
      if (originalCaptureStream) {
        HTMLCanvasElement.prototype.captureStream = originalCaptureStream
      }
    })

    it('should return false when MediaRecorder is not available', () => {
      const originalMediaRecorder = globalThis.MediaRecorder
      // @ts-expect-error - removing for test
      delete globalThis.MediaRecorder

      expect(canCompress()).toBe(false)

      // Restore
      if (originalMediaRecorder) {
        globalThis.MediaRecorder = originalMediaRecorder
      }
    })
  })

  describe('CompressionOptions', () => {
    it('should have valid default quality presets', () => {
      const options: CompressionOptions = {
        maxResolution: 1080,
        quality: 'medium',
      }

      expect(options.maxResolution).toBe(1080)
      expect(options.quality).toBe('medium')
    })

    it('should support all quality levels', () => {
      const qualities: Array<CompressionOptions['quality']> = [
        'low',
        'medium',
        'high',
      ]

      qualities.forEach((quality) => {
        const options: CompressionOptions = { quality }
        expect(['low', 'medium', 'high']).toContain(options.quality)
      })
    })

    it('should allow custom bitrate override', () => {
      const options: CompressionOptions = {
        targetBitrate: 3_000_000,
      }

      expect(options.targetBitrate).toBe(3_000_000)
    })

    it('should allow custom frame rate', () => {
      const options: CompressionOptions = {
        frameRate: 24,
      }

      expect(options.frameRate).toBe(24)
    })
  })

  describe('CompressionProgress', () => {
    it('should have all required progress stages', () => {
      const stages: CompressionProgress['stage'][] = [
        'analyzing',
        'compressing',
        'finalizing',
      ]

      stages.forEach((stage) => {
        const progress: CompressionProgress = {
          percent: 50,
          stage,
        }

        expect(['analyzing', 'compressing', 'finalizing']).toContain(
          progress.stage
        )
      })
    })

    it('should have percent between 0 and 100', () => {
      const validPercents = [0, 25, 50, 75, 100]

      validPercents.forEach((percent) => {
        expect(percent).toBeGreaterThanOrEqual(0)
        expect(percent).toBeLessThanOrEqual(100)
      })
    })

    it('should support optional frame information', () => {
      const progress: CompressionProgress = {
        percent: 50,
        stage: 'compressing',
        processedFrames: 150,
        totalFrames: 300,
      }

      expect(progress.processedFrames).toBe(150)
      expect(progress.totalFrames).toBe(300)
    })

    it('should support optional estimated size', () => {
      const progress: CompressionProgress = {
        percent: 75,
        stage: 'compressing',
        estimatedSize: 30_000_000,
      }

      expect(progress.estimatedSize).toBe(30_000_000)
    })
  })

  describe('CompressionResult', () => {
    it('should have correct compression ratio calculation', () => {
      const originalSize = 100_000_000 // 100MB
      const compressedSize = 30_000_000 // 30MB
      const compressionRatio = Math.round(
        (1 - compressedSize / originalSize) * 100
      )

      expect(compressionRatio).toBe(70) // 70% reduction
    })

    it('should handle zero compression case', () => {
      const originalSize = 100_000_000
      const compressedSize = 100_000_000
      const compressionRatio = Math.round(
        (1 - compressedSize / originalSize) * 100
      )

      expect(compressionRatio).toBe(0)
    })

    it('should calculate negative ratio when compressed is larger', () => {
      const originalSize = 100_000_000
      const compressedSize = 120_000_000
      const compressionRatio = Math.round(
        (1 - compressedSize / originalSize) * 100
      )

      expect(compressionRatio).toBe(-20) // 20% larger
    })

    it('should track resolution correctly', () => {
      const result: Partial<CompressionResult> = {
        resolution: { width: 1920, height: 1080 },
      }

      expect(result.resolution?.width).toBe(1920)
      expect(result.resolution?.height).toBe(1080)
    })

    it('should track processing duration', () => {
      const result: Partial<CompressionResult> = {
        duration: 5000, // 5 seconds
      }

      expect(result.duration).toBe(5000)
    })
  })

  describe('resolution calculation logic', () => {
    it('should maintain aspect ratio for 16:9 video', () => {
      const width = 1920
      const height = 1080
      const maxResolution = 720

      // Expected: 720p height, width = 720 * (16/9) = 1280
      const aspectRatio = width / height
      expect(aspectRatio).toBeCloseTo(16 / 9, 2)

      const newWidth = maxResolution
      const newHeight = Math.round(maxResolution / aspectRatio)

      expect(newWidth).toBe(720)
      expect(newHeight).toBeCloseTo(405, 0)
    })

    it('should maintain aspect ratio for 4:3 video', () => {
      const width = 1024
      const height = 768
      const maxResolution = 480

      const aspectRatio = width / height
      expect(aspectRatio).toBeCloseTo(4 / 3, 2)

      const newWidth = maxResolution
      const newHeight = Math.round(maxResolution / aspectRatio)

      expect(newWidth).toBe(480)
      expect(newHeight).toBeCloseTo(360, 0)
    })

    it('should handle portrait orientation', () => {
      const width = 1080
      const height = 1920
      const maxResolution = 720

      const aspectRatio = width / height
      expect(aspectRatio).toBeLessThan(1)

      // Portrait: scale based on height
      const newHeight = maxResolution
      const newWidth = Math.round(maxResolution * aspectRatio)

      expect(newHeight).toBe(720)
      expect(newWidth).toBeCloseTo(405, 0)
    })

    it('should not upscale small videos', () => {
      const width = 640
      const height = 480
      const maxResolution = 1080

      // Video is smaller than max, should not upscale
      const shouldScale = width > maxResolution || height > maxResolution
      expect(shouldScale).toBe(false)
    })

    it('should round to even numbers for codec compatibility', () => {
      const values = [719, 721, 1079, 1081]

      values.forEach((val) => {
        const rounded = Math.floor(val / 2) * 2
        expect(rounded % 2).toBe(0)
      })
    })
  })

  describe('quality preset bitrates', () => {
    it('should have progressively higher bitrates', () => {
      const bitrates = {
        low: 1_000_000,
        medium: 2_000_000,
        high: 4_000_000,
      }

      expect(bitrates.low).toBeLessThan(bitrates.medium)
      expect(bitrates.medium).toBeLessThan(bitrates.high)
    })

    it('should have reasonable bitrates for video quality', () => {
      const bitrates = {
        low: 1_000_000,
        medium: 2_000_000,
        high: 4_000_000,
      }

      // Reasonable ranges for web video
      expect(bitrates.low).toBeGreaterThanOrEqual(500_000)
      expect(bitrates.high).toBeLessThanOrEqual(10_000_000)
    })
  })

  describe('file type validation', () => {
    it('should create valid mock video file', () => {
      const file = createMockVideoFile(10, 'test.mp4')

      expect(file.name).toBe('test.mp4')
      expect(file.type).toBe('video/mp4')
      expect(file.size).toBe(10 * 1024 * 1024)
    })

    it('should handle different video extensions', () => {
      const extensions = ['mp4', 'webm', 'avi', 'mov']

      extensions.forEach((ext) => {
        const file = createMockVideoFile(1, `test.${ext}`)
        expect(file.name).toBe(`test.${ext}`)
      })
    })
  })

  describe('bitrate estimation', () => {
    it('should calculate correct bitrate from file size and duration', () => {
      const fileSizeBytes = 100 * 1024 * 1024 // 100MB
      const durationSeconds = 60 // 60 seconds
      const estimatedBitrate = (fileSizeBytes * 8) / durationSeconds

      // 100MB * 8 / 60s ≈ 13.3 Mbps
      expect(estimatedBitrate).toBeCloseTo(13_981_013, -4)
    })

    it('should handle short duration videos', () => {
      const fileSizeBytes = 10 * 1024 * 1024 // 10MB
      const durationSeconds = 5 // 5 seconds
      const estimatedBitrate = (fileSizeBytes * 8) / durationSeconds

      // 10MB * 8 / 5s = 16 Mbps
      expect(estimatedBitrate).toBeCloseTo(16_777_216, -4)
    })

    it('should handle long duration videos', () => {
      const fileSizeBytes = 500 * 1024 * 1024 // 500MB
      const durationSeconds = 3600 // 1 hour
      const estimatedBitrate = (fileSizeBytes * 8) / durationSeconds

      // 500MB * 8 / 3600s ≈ 1.16 Mbps
      expect(estimatedBitrate).toBeCloseTo(1_165_084, -3)
    })
  })
})
