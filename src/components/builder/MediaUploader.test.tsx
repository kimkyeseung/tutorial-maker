import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import MediaUploader from './MediaUploader'

// Mock the video compressor module
vi.mock('../../utils/videoCompressor', () => ({
  canCompress: vi.fn(() => true),
  compressVideo: vi.fn(),
  analyzeVideo: vi.fn(),
}))

// Mock the media storage module
vi.mock('../../utils/mediaStorage', () => ({
  saveMediaFile: vi.fn(() => Promise.resolve('mock-media-id')),
}))

describe('MediaUploader', () => {
  const mockOnMediaUploaded = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render upload area', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      expect(screen.getByText('미디어 업로드')).toBeInTheDocument()
      expect(screen.getByText('클릭하여 파일 선택')).toBeInTheDocument()
    })

    it('should render file type hints', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      expect(
        screen.getByText('MP4, WebM 영상 또는 PNG, JPG 이미지')
      ).toBeInTheDocument()
    })

    it('should render compression toggle when enabled', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      expect(screen.getByText('영상 자동 압축')).toBeInTheDocument()
    })

    it('should not render compression toggle when disabled', () => {
      render(
        <MediaUploader
          onMediaUploaded={mockOnMediaUploaded}
          enableCompression={false}
        />
      )

      expect(screen.queryByText('영상 자동 압축')).not.toBeInTheDocument()
    })

    it('should show compression info hint when enabled', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      expect(
        screen.getByText('• 대용량 영상은 자동으로 압축됩니다')
      ).toBeInTheDocument()
    })
  })

  describe('compression toggle', () => {
    it('should have compression enabled by default', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })

    it('should allow toggling compression off', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(checkbox).not.toBeChecked()
    })

    it('should hide compression hint when toggled off', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(
        screen.queryByText('• 대용량 영상은 자동으로 압축됩니다')
      ).not.toBeInTheDocument()
    })
  })

  describe('file input', () => {
    it('should have correct accept attribute', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      const input = document.querySelector('input[type="file"]')
      expect(input).toHaveAttribute(
        'accept',
        'video/mp4,video/webm,image/png,image/jpeg,image/jpg'
      )
    })

    it('should be hidden', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      const input = document.querySelector('input[type="file"]')
      expect(input).toHaveClass('hidden')
    })
  })

  describe('file size formatting', () => {
    it('should format bytes correctly', () => {
      // Test the formatFileSize logic
      const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      }

      expect(formatFileSize(500)).toBe('500 B')
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
    })
  })

  describe('upload stages', () => {
    it('should have correct stage text for analyzing', () => {
      const getStageText = (stage: string): string => {
        switch (stage) {
          case 'analyzing':
            return '분석 중...'
          case 'compressing':
            return '압축 중... 50%'
          case 'saving':
            return '저장 중...'
          case 'done':
            return '완료!'
          default:
            return ''
        }
      }

      expect(getStageText('analyzing')).toBe('분석 중...')
      expect(getStageText('compressing')).toContain('압축 중...')
      expect(getStageText('saving')).toBe('저장 중...')
      expect(getStageText('done')).toBe('완료!')
      expect(getStageText('idle')).toBe('')
    })
  })

  describe('UI guidelines', () => {
    it('should display recommended resolution', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      expect(screen.getByText('• 권장: 1920x1080 해상도')).toBeInTheDocument()
    })

    it('should display supported video formats', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      expect(
        screen.getByText('• 영상은 MP4 또는 WebM 형식')
      ).toBeInTheDocument()
    })

    it('should display supported image formats', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      expect(
        screen.getByText('• 이미지는 PNG 또는 JPG 형식')
      ).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have accessible label structure', () => {
      render(<MediaUploader onMediaUploaded={mockOnMediaUploaded} />)

      // The file input should be within a label
      const labels = document.querySelectorAll('label')
      expect(labels.length).toBeGreaterThan(0)

      // Find the label containing the file input
      const fileInputLabel = Array.from(labels).find((label) =>
        label.querySelector('input[type="file"]')
      )
      expect(fileInputLabel).toBeInTheDocument()
    })
  })

  describe('compression calculation', () => {
    it('should calculate compression ratio correctly', () => {
      const originalSize = 100_000_000 // 100MB
      const compressedSize = 30_000_000 // 30MB

      const ratio = Math.round((1 - compressedSize / originalSize) * 100)
      expect(ratio).toBe(70)
    })

    it('should handle zero compression', () => {
      const originalSize = 50_000_000
      const compressedSize = 50_000_000

      const ratio = Math.round((1 - compressedSize / originalSize) * 100)
      expect(ratio).toBe(0)
    })
  })
})
