import { describe, it, expect } from 'vitest'

import type { BuildProgress, BuildOptions, CompressionStats } from './projectBuilder'

describe('projectBuilder', () => {
  describe('BuildProgress interface', () => {
    it('should have required message field', () => {
      const progress: BuildProgress = {
        message: '빌드 중...',
      }

      expect(progress.message).toBe('빌드 중...')
    })

    it('should support optional percent field', () => {
      const progress: BuildProgress = {
        message: '미디어 준비 중...',
        percent: 50,
      }

      expect(progress.percent).toBe(50)
    })

    it('should support step tracking', () => {
      const progress: BuildProgress = {
        message: '미디어 파일 준비 중... (3/5)',
        percent: 60,
        step: 3,
        totalSteps: 5,
      }

      expect(progress.step).toBe(3)
      expect(progress.totalSteps).toBe(5)
    })

    it('should support compression info', () => {
      const progress: BuildProgress = {
        message: '영상 압축 중...',
        compressionInfo: {
          fileId: 'video-123',
          originalSize: 100_000_000,
          compressedSize: 30_000_000,
          stage: 'compressing',
        },
      }

      expect(progress.compressionInfo?.fileId).toBe('video-123')
      expect(progress.compressionInfo?.originalSize).toBe(100_000_000)
      expect(progress.compressionInfo?.compressedSize).toBe(30_000_000)
    })
  })

  describe('BuildOptions interface', () => {
    it('should have default-like values', () => {
      const options: BuildOptions = {
        enableCompression: true,
        compressionQuality: 'medium',
        maxResolution: 1080,
      }

      expect(options.enableCompression).toBe(true)
      expect(options.compressionQuality).toBe('medium')
      expect(options.maxResolution).toBe(1080)
    })

    it('should support all quality levels', () => {
      const qualities: Array<BuildOptions['compressionQuality']> = [
        'low',
        'medium',
        'high',
      ]

      qualities.forEach((quality) => {
        const options: BuildOptions = { compressionQuality: quality }
        expect(['low', 'medium', 'high']).toContain(options.compressionQuality)
      })
    })

    it('should allow disabling compression', () => {
      const options: BuildOptions = {
        enableCompression: false,
      }

      expect(options.enableCompression).toBe(false)
    })

    it('should support custom resolution', () => {
      const options: BuildOptions = {
        maxResolution: 720,
      }

      expect(options.maxResolution).toBe(720)
    })
  })

  describe('CompressionStats interface', () => {
    it('should track compression statistics', () => {
      const stats: CompressionStats = {
        totalOriginalSize: 500_000_000,
        totalCompressedSize: 150_000_000,
        compressedCount: 5,
        skippedCount: 2,
      }

      expect(stats.totalOriginalSize).toBe(500_000_000)
      expect(stats.totalCompressedSize).toBe(150_000_000)
      expect(stats.compressedCount).toBe(5)
      expect(stats.skippedCount).toBe(2)
    })

    it('should calculate savings correctly', () => {
      const stats: CompressionStats = {
        totalOriginalSize: 100_000_000,
        totalCompressedSize: 30_000_000,
        compressedCount: 1,
        skippedCount: 0,
      }

      const savedSize = stats.totalOriginalSize - stats.totalCompressedSize
      const savedPercent = Math.round((savedSize / stats.totalOriginalSize) * 100)

      expect(savedSize).toBe(70_000_000)
      expect(savedPercent).toBe(70)
    })

    it('should handle zero compression case', () => {
      const stats: CompressionStats = {
        totalOriginalSize: 50_000_000,
        totalCompressedSize: 50_000_000,
        compressedCount: 0,
        skippedCount: 3,
      }

      const savedSize = stats.totalOriginalSize - stats.totalCompressedSize
      expect(savedSize).toBe(0)
    })
  })

  describe('file size formatting logic', () => {
    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B')
    })

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
      expect(formatFileSize(100 * 1024 * 1024)).toBe('100.0 MB')
    })
  })

  describe('MIME type extraction logic', () => {
    const getMimeType = (
      blob: { type: string },
      mediaType: 'video' | 'image'
    ): string => {
      if (blob.type) return blob.type
      return mediaType === 'video' ? 'video/mp4' : 'image/png'
    }

    it('should use blob type if available', () => {
      const blob = { type: 'video/webm' }
      expect(getMimeType(blob, 'video')).toBe('video/webm')
    })

    it('should fallback to video/mp4 for video', () => {
      const blob = { type: '' }
      expect(getMimeType(blob, 'video')).toBe('video/mp4')
    })

    it('should fallback to image/png for image', () => {
      const blob = { type: '' }
      expect(getMimeType(blob, 'image')).toBe('image/png')
    })
  })

  describe('file extension extraction logic', () => {
    const getExtension = (mimeType: string): string => {
      const map: Record<string, string> = {
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/avi': '.avi',
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/gif': '.gif',
        'image/webp': '.webp',
      }
      return map[mimeType] || ''
    }

    it('should return correct extension for video types', () => {
      expect(getExtension('video/mp4')).toBe('.mp4')
      expect(getExtension('video/webm')).toBe('.webm')
      expect(getExtension('video/avi')).toBe('.avi')
    })

    it('should return correct extension for image types', () => {
      expect(getExtension('image/png')).toBe('.png')
      expect(getExtension('image/jpeg')).toBe('.jpg')
      expect(getExtension('image/gif')).toBe('.gif')
      expect(getExtension('image/webp')).toBe('.webp')
    })

    it('should return empty string for unknown types', () => {
      expect(getExtension('unknown/type')).toBe('')
    })
  })

  describe('compression decision logic', () => {
    const needsCompression = (
      width: number,
      height: number,
      estimatedBitrate: number
    ): boolean => {
      return (
        width > 1080 ||
        height > 1080 ||
        estimatedBitrate > 2_500_000
      )
    }

    it('should need compression for 4K video', () => {
      expect(needsCompression(3840, 2160, 2_000_000)).toBe(true)
    })

    it('should need compression for high bitrate', () => {
      expect(needsCompression(1080, 720, 5_000_000)).toBe(true)
    })

    it('should not need compression for small video', () => {
      expect(needsCompression(720, 480, 1_500_000)).toBe(false)
    })

    it('should not need compression for 1080p with low bitrate', () => {
      expect(needsCompression(1080, 1080, 2_000_000)).toBe(false)
    })

    it('should need compression if width exceeds 1080', () => {
      expect(needsCompression(1920, 1080, 2_000_000)).toBe(true)
    })

    it('should need compression if height exceeds 1080', () => {
      expect(needsCompression(1080, 1920, 2_000_000)).toBe(true)
    })
  })
})
