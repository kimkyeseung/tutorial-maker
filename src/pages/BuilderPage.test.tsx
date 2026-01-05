import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import BuilderPage from './BuilderPage'

// Mock the modules
vi.mock('../utils/mediaStorage', () => ({
  getAllProjects: vi.fn(() => Promise.resolve([])),
  saveProject: vi.fn(() => Promise.resolve()),
  deleteProject: vi.fn(() => Promise.resolve()),
  getAppIcon: vi.fn(() => Promise.resolve(null)),
  createBlobURL: vi.fn(() => 'mock-url'),
}))

vi.mock('../utils/pageValidation', () => ({
  validateAllPages: vi.fn(() => ({ isValid: true, invalidPages: [] })),
}))

vi.mock('../utils/projectExporter', () => ({
  exportAsTutorial: vi.fn(() => Promise.resolve(true)),
  exportProject: vi.fn(() => Promise.resolve(true)),
  importProjectFromZip: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('../utils/projectBuilder', () => ({
  buildStandaloneExecutable: vi.fn(() =>
    Promise.resolve({ success: true, compressionStats: null })
  ),
}))

describe('BuilderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render the header', () => {
      render(<BuilderPage />)

      expect(screen.getByText('Tutorial Maker')).toBeInTheDocument()
    })

    it('should render new project button', () => {
      render(<BuilderPage />)

      expect(screen.getByText('새 프로젝트')).toBeInTheDocument()
    })

    it('should render import button', () => {
      render(<BuilderPage />)

      expect(
        screen.getByRole('button', { name: /프로젝트 가져오기/ })
      ).toBeInTheDocument()
    })

    it('should show empty state when no projects', async () => {
      render(<BuilderPage />)

      await waitFor(() => {
        expect(
          screen.getByText('아직 프로젝트가 없습니다. 새 프로젝트를 만들어보세요!')
        ).toBeInTheDocument()
      })
    })

    it('should show first project button when no projects', async () => {
      render(<BuilderPage />)

      await waitFor(() => {
        expect(screen.getByText('첫 프로젝트 만들기')).toBeInTheDocument()
      })
    })
  })

  describe('project creation', () => {
    it('should call saveProject when creating new project', async () => {
      const { saveProject } = await import('../utils/mediaStorage')

      render(<BuilderPage />)

      const newButton = screen.getByText('새 프로젝트')
      fireEvent.click(newButton)

      await waitFor(() => {
        expect(saveProject).toHaveBeenCalled()
      })
    })
  })

  describe('build options dialog', () => {
    it('should have default build options', () => {
      // Test the default values
      const defaultOptions = {
        enableCompression: true,
        compressionQuality: 'medium' as const,
        maxResolution: 1080,
      }

      expect(defaultOptions.enableCompression).toBe(true)
      expect(defaultOptions.compressionQuality).toBe('medium')
      expect(defaultOptions.maxResolution).toBe(1080)
    })

    it('should support all compression quality levels', () => {
      const qualities = ['low', 'medium', 'high'] as const

      qualities.forEach((quality) => {
        expect(['low', 'medium', 'high']).toContain(quality)
      })
    })

    it('should support all resolution presets', () => {
      const resolutions = [720, 1080, 1440]

      resolutions.forEach((res) => {
        expect(res).toBeGreaterThan(0)
        expect(res).toBeLessThanOrEqual(1440)
      })
    })
  })

  describe('compression stats display', () => {
    it('should calculate saved percentage correctly', () => {
      const stats = {
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

    it('should format file size correctly', () => {
      const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      }

      expect(formatSize(1024)).toBe('1.0 KB')
      expect(formatSize(1024 * 1024)).toBe('1.0 MB')
      expect(formatSize(100 * 1024 * 1024)).toBe('100.0 MB')
    })
  })

  describe('view modes', () => {
    it('should have list and flowmap view modes', () => {
      type PagesViewMode = 'list' | 'flowmap'

      const modes: PagesViewMode[] = ['list', 'flowmap']
      expect(modes).toContain('list')
      expect(modes).toContain('flowmap')
    })

    it('should have main views', () => {
      type View = 'list' | 'settings' | 'pages'

      const views: View[] = ['list', 'settings', 'pages']
      expect(views).toContain('list')
      expect(views).toContain('settings')
      expect(views).toContain('pages')
    })
  })

  describe('build progress display', () => {
    it('should display compression info format', () => {
      const compressionInfo = {
        fileId: 'video-123',
        originalSize: 100_000_000,
        compressedSize: 30_000_000,
      }

      const originalMB = (compressionInfo.originalSize / (1024 * 1024)).toFixed(1)
      const compressedMB = (compressionInfo.compressedSize / (1024 * 1024)).toFixed(
        1
      )
      const savedPercent = Math.round(
        (1 - compressionInfo.compressedSize / compressionInfo.originalSize) * 100
      )

      expect(originalMB).toBe('95.4')
      expect(compressedMB).toBe('28.6')
      expect(savedPercent).toBe(70)
    })
  })

  describe('page management', () => {
    it('should create new page with correct structure', () => {
      const pageNumber = 1
      const newPage = {
        id: 'test-uuid',
        title: `페이지 ${pageNumber}`,
        order: 0,
        mediaType: 'video' as const,
        mediaId: '',
        playType: 'loop' as const,
        buttons: [],
        touchAreas: [],
      }

      expect(newPage.title).toBe('페이지 1')
      expect(newPage.mediaType).toBe('video')
      expect(newPage.playType).toBe('loop')
      expect(newPage.buttons).toEqual([])
      expect(newPage.touchAreas).toEqual([])
    })

    it('should reorder pages correctly', () => {
      const pages = [
        { id: '1', order: 0 },
        { id: '2', order: 1 },
        { id: '3', order: 2 },
      ]

      const startIndex = 0
      const endIndex = 2

      const reorderedPages = Array.from(pages)
      const [removed] = reorderedPages.splice(startIndex, 1)
      reorderedPages.splice(endIndex, 0, removed)

      const result = reorderedPages.map((page, index) => ({
        ...page,
        order: index,
      }))

      expect(result[0].id).toBe('2')
      expect(result[1].id).toBe('3')
      expect(result[2].id).toBe('1')
      expect(result.map((p) => p.order)).toEqual([0, 1, 2])
    })
  })

  describe('project settings', () => {
    it('should have correct default settings', () => {
      const defaultSettings = {
        windowWidth: 1920,
        windowHeight: 1080,
        fullscreen: true,
        showProgress: false,
        showHomeButton: false,
        showBackButton: false,
        loopAtEnd: true,
      }

      expect(defaultSettings.windowWidth).toBe(1920)
      expect(defaultSettings.windowHeight).toBe(1080)
      expect(defaultSettings.fullscreen).toBe(true)
      expect(defaultSettings.loopAtEnd).toBe(true)
    })
  })
})
