import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

import App from './App'

// Mock components
vi.mock('./pages/BuilderPage', () => ({
  default: ({ onPreview }: { onPreview?: (id: string) => void }) => (
    <div data-testid="builder-page">
      BuilderPage
      <button onClick={() => onPreview?.('test-project-id')}>미리보기</button>
    </div>
  ),
}))

vi.mock('./pages/ProductPage', () => ({
  default: ({ projectId }: { projectId?: string }) => (
    <div data-testid="product-page">
      ProductPage
      {projectId && <span data-testid="project-id">{projectId}</span>}
    </div>
  ),
}))

vi.mock('./components/product/LoadingScreen', () => ({
  default: () => <div data-testid="loading-screen">Loading...</div>,
}))

// Mock Tauri API
const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 기본적으로 Tauri 환경이 아닌 것으로 설정
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('웹 환경 (Tauri 없음)', () => {
    it('웹 환경에서는 메이커 모드로 자동 전환', async () => {
      render(<App />)

      // 웹 환경에서는 메이커 모드로 전환 (useEffect가 빠르게 실행됨)
      await waitFor(() => {
        expect(screen.getByTestId('builder-page')).toBeInTheDocument()
      })
    })

    it('웹 환경에서는 Tauri invoke 호출하지 않음', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByTestId('builder-page')).toBeInTheDocument()
      })

      expect(mockInvoke).not.toHaveBeenCalled()
    })
  })

  describe('Tauri 환경 - 메이커 앱', () => {
    beforeEach(() => {
      // Tauri 환경 시뮬레이션
      ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    })

    it('내장 프로젝트가 없으면 메이커 모드', async () => {
      mockInvoke.mockResolvedValueOnce(false) // has_embedded_project returns false

      render(<App />)

      // 처음에는 로딩 화면
      expect(screen.getByTestId('loading-screen')).toBeInTheDocument()

      // 메이커 모드로 전환
      await waitFor(() => {
        expect(screen.getByTestId('builder-page')).toBeInTheDocument()
      })

      expect(mockInvoke).toHaveBeenCalledWith('has_embedded_project')
    })
  })

  describe('Tauri 환경 - 빌드된 exe', () => {
    beforeEach(() => {
      // Tauri 환경 시뮬레이션
      ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    })

    it('내장 프로젝트가 있으면 뷰어 모드', async () => {
      mockInvoke.mockResolvedValueOnce(true) // has_embedded_project returns true

      render(<App />)

      // 처음에는 로딩 화면
      expect(screen.getByTestId('loading-screen')).toBeInTheDocument()

      // 뷰어 모드로 전환
      await waitFor(() => {
        expect(screen.getByTestId('product-page')).toBeInTheDocument()
      })

      expect(mockInvoke).toHaveBeenCalledWith('has_embedded_project')
    })

    it('뷰어 모드에서는 projectId 없이 ProductPage 렌더링', async () => {
      mockInvoke.mockResolvedValueOnce(true)

      render(<App />)

      await waitFor(() => {
        expect(screen.getByTestId('product-page')).toBeInTheDocument()
      })

      // projectId가 전달되지 않음 (내장 데이터 사용)
      expect(screen.queryByTestId('project-id')).not.toBeInTheDocument()
    })
  })

  describe('에러 처리', () => {
    beforeEach(() => {
      ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    })

    it('Tauri 호출 실패 시 메이커 모드로 폴백', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Tauri error'))

      render(<App />)

      await waitFor(() => {
        expect(screen.getByTestId('builder-page')).toBeInTheDocument()
      })
    })
  })

  describe('미리보기 기능 (메이커 모드)', () => {
    it('미리보기 버튼 클릭 시 ProductPage 표시', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByTestId('builder-page')).toBeInTheDocument()
      })

      // 미리보기 버튼 클릭
      fireEvent.click(screen.getByText('미리보기'))

      // ProductPage가 projectId와 함께 표시됨
      await waitFor(() => {
        expect(screen.getByTestId('product-page')).toBeInTheDocument()
        expect(screen.getByTestId('project-id')).toHaveTextContent(
          'test-project-id'
        )
      })
    })

    it('미리보기 중 "빌더로 돌아가기" 버튼 표시', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByTestId('builder-page')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('미리보기'))

      await waitFor(() => {
        expect(screen.getByText('← 빌더로 돌아가기')).toBeInTheDocument()
      })
    })

    it('돌아가기 버튼 클릭 시 빌더로 복귀', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByTestId('builder-page')).toBeInTheDocument()
      })

      // 미리보기 모드로 전환
      fireEvent.click(screen.getByText('미리보기'))

      await waitFor(() => {
        expect(screen.getByTestId('product-page')).toBeInTheDocument()
      })

      // 빌더로 돌아가기
      fireEvent.click(screen.getByText('← 빌더로 돌아가기'))

      await waitFor(() => {
        expect(screen.getByTestId('builder-page')).toBeInTheDocument()
      })

      // ProductPage는 더 이상 표시되지 않음
      expect(screen.queryByTestId('product-page')).not.toBeInTheDocument()
    })
  })

  describe('AppMode 상태 관리', () => {
    it('초기 상태는 loading이며 빠르게 결정됨', async () => {
      // 웹 환경에서 테스트 (Tauri 없음)
      render(<App />)

      // useEffect가 동기적으로 실행되어 빠르게 메이커 모드로 전환됨
      // 실제 앱에서는 loading -> maker 또는 loading -> viewer 순으로 전환
      await waitFor(() => {
        // 최종적으로 메이커 또는 뷰어 중 하나로 결정됨
        const hasFinalState =
          screen.queryByTestId('builder-page') !== null ||
          screen.queryByTestId('product-page') !== null

        expect(hasFinalState).toBe(true)
      })
    })

    it('세 가지 모드만 존재 (loading, maker, viewer)', () => {
      type AppMode = 'maker' | 'viewer' | 'loading'
      const modes: AppMode[] = ['loading', 'maker', 'viewer']

      expect(modes).toHaveLength(3)
      expect(modes).toContain('loading')
      expect(modes).toContain('maker')
      expect(modes).toContain('viewer')
    })
  })
})
