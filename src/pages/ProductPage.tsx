import React, { useState, useEffect, useMemo } from 'react'
import VideoPlayer from '../components/product/VideoPlayer'
import type { Project } from '../types/project'
import {
  getAllProjects,
  getMediaFile,
  createBlobURL,
} from '../utils/mediaStorage'

const ProductPage: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [mountedPages, setMountedPages] = useState<Set<number>>(new Set([0]))

  useEffect(() => {
    loadProjectData()
  }, [])

  const loadProjectData = async () => {
    try {
      const isProductMode = import.meta.env.VITE_APP_MODE === 'product'

      let projectData: Project

      if (isProductMode) {
        // 프로덕트 모드: Rust 백엔드에서 실행 파일과 같은 디렉토리의 project.json 로드
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          const projectJson = await invoke<string>('read_project_file')
          projectData = JSON.parse(projectJson)
        } catch (e) {
          console.error('Failed to load project.json:', e)
          setIsLoading(false)
          return
        }
      } else {
        // 개발 모드: IndexedDB에서 로드
        const projects = await getAllProjects()
        if (projects.length === 0) {
          console.error('No projects found')
          setIsLoading(false)
          return
        }
        projectData = projects[0]
      }

      setProject(projectData)

      // 모든 미디어 파일 로드
      const urls: Record<string, string> = {}
      for (const page of projectData.pages) {
        if (page.mediaId) {
          if (isProductMode) {
            // 프로덕트 모드: Rust 백엔드에서 직접 미디어 파일 읽기
            try {
              const { invoke } = await import('@tauri-apps/api/core')
              const mediaData = await invoke<number[]>('read_media_file', {
                mediaId: page.mediaId,
              })
              // 바이너리 데이터를 Blob으로 변환
              const uint8Array = new Uint8Array(mediaData)
              const blob = new Blob([uint8Array])
              urls[page.mediaId] = URL.createObjectURL(blob)
            } catch (e) {
              console.error('Failed to load media:', page.mediaId, e)
            }
          } else {
            // 개발 모드: IndexedDB에서 로드
            const media = await getMediaFile(page.mediaId)
            if (media) {
              urls[page.mediaId] = createBlobURL(media.blob)
            }
          }
        }
      }

      setMediaUrls(urls)
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load project data:', error)
      setIsLoading(false)
    }
  }

  const goToNextPage = () => {
    if (!project) return

    if (currentPageIndex < project.pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1)
    } else if (project.settings.loopAtEnd) {
      setCurrentPageIndex(0)
    }
  }

  const goToPreviousPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1)
    }
  }

  const goToHome = () => {
    setCurrentPageIndex(0)
  }

  const goToPage = (pageIndex: number) => {
    if (!project) return
    if (pageIndex >= 0 && pageIndex < project.pages.length) {
      setCurrentPageIndex(pageIndex)
    }
  }

  const handleVideoEnd = () => {
    // 단일 재생 모드일 때만 자동으로 다음 페이지로
    if (project?.pages[currentPageIndex]?.playType === 'single') {
      goToNextPage()
    }
  }

  const handleButtonClick = (buttonId: string) => {
    if (!project) return

    const currentPage = project.pages[currentPageIndex]
    const button = currentPage.buttons.find((b) => b.id === buttonId)

    if (!button) return

    if (button.action.type === 'next') {
      goToNextPage()
    } else if (
      button.action.type === 'goto' &&
      button.action.targetPageId !== undefined
    ) {
      const targetIndex = parseInt(button.action.targetPageId)
      goToPage(targetIndex)
    }
  }

  const handleTouchAreaClick = (touchAreaId: string) => {
    if (!project) return

    const currentPage = project.pages[currentPageIndex]
    const touchArea = currentPage.touchAreas.find((t) => t.id === touchAreaId)

    if (!touchArea) return

    if (touchArea.action.type === 'next') {
      goToNextPage()
    } else if (
      touchArea.action.type === 'goto' &&
      touchArea.action.targetPageId !== undefined
    ) {
      const targetIndex = parseInt(touchArea.action.targetPageId)
      goToPage(targetIndex)
    }
  }

  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!project) return

      // 종료 키 확인
      if (project.settings.exitKey && e.key === project.settings.exitKey) {
        if (confirm('앱을 종료하시겠습니까?')) {
          window.close()
        }
        return
      }

      // 화살표 키 네비게이션
      if (e.key === 'ArrowRight') {
        goToNextPage()
      } else if (e.key === 'ArrowLeft') {
        goToPreviousPage()
      } else if (e.key === 'Home') {
        goToHome()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [project, currentPageIndex])

  // 현재 페이지에서 연결된 페이지들 계산 (프리로딩 대상)
  const connectedPages = useMemo(() => {
    if (!project) return new Set<number>()

    const connected = new Set<number>([currentPageIndex])
    const currentPage = project.pages[currentPageIndex]

    if (!currentPage) return connected

    // 다음 페이지 (버튼/터치에서 'next' 액션이 있거나, single 재생 타입일 때)
    const nextIndex = currentPageIndex + 1
    if (nextIndex < project.pages.length) {
      connected.add(nextIndex)
    } else if (project.settings.loopAtEnd) {
      connected.add(0) // 마지막에서 처음으로
    }

    // 버튼에서 goto로 연결된 페이지들
    currentPage.buttons.forEach((button) => {
      if (button.action.type === 'goto' && button.action.targetPageId !== undefined) {
        const targetIndex = parseInt(button.action.targetPageId)
        if (targetIndex >= 0 && targetIndex < project.pages.length) {
          connected.add(targetIndex)
        }
      }
    })

    // 터치 영역에서 goto로 연결된 페이지들
    currentPage.touchAreas.forEach((touchArea) => {
      if (touchArea.action.type === 'goto' && touchArea.action.targetPageId !== undefined) {
        const targetIndex = parseInt(touchArea.action.targetPageId)
        if (targetIndex >= 0 && targetIndex < project.pages.length) {
          connected.add(targetIndex)
        }
      }
    })

    return connected
  }, [project, currentPageIndex])

  // 연결된 페이지들을 마운트된 페이지 목록에 추가
  useEffect(() => {
    setMountedPages((prev) => {
      const newSet = new Set(prev)
      connectedPages.forEach((pageIndex) => newSet.add(pageIndex))
      return newSet
    })
  }, [connectedPages])

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gray-900 text-white'>
        <div className='text-center'>
          <div className='mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-b-2 border-t-2 border-white'></div>
          <p>프로젝트 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gray-900 text-white'>
        <div className='text-center'>
          <p className='mb-4 text-xl'>프로젝트를 찾을 수 없습니다</p>
          <p className='text-sm text-gray-400'>
            빌더 페이지에서 프로젝트를 먼저 만들어주세요
          </p>
        </div>
      </div>
    )
  }

  if (project.pages.length === 0) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gray-900 text-white'>
        <div className='text-center'>
          <p className='mb-4 text-xl'>페이지가 없습니다</p>
          <p className='text-sm text-gray-400'>
            빌더 페이지에서 페이지를 추가해주세요
          </p>
        </div>
      </div>
    )
  }

  const currentPage = project.pages[currentPageIndex]

  return (
    <div className='relative h-screen w-screen overflow-hidden bg-black'>
      {/* 마운트된 모든 페이지 렌더링 (프리로딩) */}
      {Array.from(mountedPages).map((pageIndex) => {
        const page = project.pages[pageIndex]
        const mediaUrl = page?.mediaId ? mediaUrls[page.mediaId] : null
        const isCurrentPage = pageIndex === currentPageIndex

        if (!page || !mediaUrl) return null

        return (
          <div
            key={page.id}
            className='absolute inset-0'
            style={{
              zIndex: isCurrentPage ? 10 : 1,
              opacity: isCurrentPage ? 1 : 0,
              pointerEvents: isCurrentPage ? 'auto' : 'none',
            }}
          >
            <VideoPlayer
              page={page}
              mediaUrl={mediaUrl}
              onVideoEnd={isCurrentPage ? handleVideoEnd : () => {}}
              onButtonClick={isCurrentPage ? handleButtonClick : () => {}}
              onTouchAreaClick={isCurrentPage ? handleTouchAreaClick : () => {}}
              isActive={isCurrentPage}
            />
          </div>
        )
      })}

      {/* 미디어 로드 실패 시 */}
      {!currentPage || !mediaUrls[currentPage?.mediaId || ''] ? (
        <div className='absolute inset-0 z-20 flex h-full w-full items-center justify-center text-white'>
          <p>미디어를 로드할 수 없습니다</p>
        </div>
      ) : null}

      {/* 컨트롤 오버레이 */}
      {(project.settings.showBackButton || project.settings.showHomeButton) && (
        <div className='absolute bottom-8 left-1/2 z-30 flex -translate-x-1/2 transform gap-4'>
          {project.settings.showBackButton && currentPageIndex > 0 && (
            <button
              onClick={goToPreviousPage}
              className='rounded-lg bg-gray-800 bg-opacity-80 px-6 py-3 text-white shadow-lg transition-all hover:bg-opacity-100'
            >
              ← 이전
            </button>
          )}

          {project.settings.showHomeButton && (
            <button
              onClick={goToHome}
              className='rounded-lg bg-gray-800 bg-opacity-80 px-6 py-3 text-white shadow-lg transition-all hover:bg-opacity-100'
            >
              🏠 처음으로
            </button>
          )}
        </div>
      )}

      {/* 진행 상황 표시 */}
      {project.settings.showProgress && (
        <div className='absolute right-4 top-4 z-30 rounded-lg bg-gray-800 bg-opacity-80 px-4 py-2 text-white shadow-lg'>
          {currentPageIndex + 1} / {project.pages.length}
        </div>
      )}

      {/* 종료 키 안내 */}
      {project.settings.exitKey && (
        <div className='absolute left-4 top-4 z-30 rounded bg-gray-800 bg-opacity-80 px-3 py-1 text-xs text-white'>
          {project.settings.exitKey} 키로 종료
        </div>
      )}
    </div>
  )
}

export default ProductPage
