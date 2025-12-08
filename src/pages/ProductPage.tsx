import React, { useState, useEffect } from 'react'
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

  useEffect(() => {
    loadProjectData()
  }, [])

  const loadProjectData = async () => {
    try {
      // 개발 모드: IndexedDB에서 첫 번째 프로젝트 로드
      const isProductMode = import.meta.env.VITE_APP_MODE === 'product'

      let projectData: Project

      if (isProductMode) {
        // 프로덕트 모드: /project.json에서 로드
        const response = await fetch('/project.json')
        projectData = await response.json()
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
          const media = await getMediaFile(page.mediaId)
          if (media) {
            urls[page.mediaId] = createBlobURL(media.blob)
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
  const mediaUrl = currentPage?.mediaId ? mediaUrls[currentPage.mediaId] : null

  return (
    <div className='relative h-screen w-screen overflow-hidden bg-black'>
      {/* 메인 콘텐츠 영역 */}
      {currentPage && mediaUrl ? (
        <VideoPlayer
          page={currentPage}
          mediaUrl={mediaUrl}
          onVideoEnd={handleVideoEnd}
          onButtonClick={handleButtonClick}
          onTouchAreaClick={handleTouchAreaClick}
        />
      ) : (
        <div className='flex h-full w-full items-center justify-center text-white'>
          <p>미디어를 로드할 수 없습니다</p>
        </div>
      )}

      {/* 컨트롤 오버레이 */}
      <div className='absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 transform gap-4'>
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

        <button
          onClick={goToNextPage}
          className='rounded-lg bg-blue-600 bg-opacity-80 px-6 py-3 text-white shadow-lg transition-all hover:bg-opacity-100'
        >
          다음 →
        </button>
      </div>

      {/* 진행 상황 표시 */}
      {project.settings.showProgress && (
        <div className='absolute right-4 top-4 z-10 rounded-lg bg-gray-800 bg-opacity-80 px-4 py-2 text-white shadow-lg'>
          {currentPageIndex + 1} / {project.pages.length}
        </div>
      )}

      {/* 종료 키 안내 */}
      {project.settings.exitKey && (
        <div className='absolute left-4 top-4 z-10 rounded bg-gray-800 bg-opacity-80 px-3 py-1 text-xs text-white'>
          {project.settings.exitKey} 키로 종료
        </div>
      )}
    </div>
  )
}

export default ProductPage
