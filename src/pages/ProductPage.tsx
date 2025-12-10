import React, { useState, useEffect } from 'react'
import VideoPlayer from '../components/product/VideoPlayer'
import EntryPage from '../components/product/EntryPage'
import ControlOverlay from '../components/product/ControlOverlay'
import LoadingScreen from '../components/product/LoadingScreen'
import ErrorScreen from '../components/product/ErrorScreen'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { useProductProject } from '../hooks/useProductProject'
import { usePageNavigation } from '../hooks/usePageNavigation'

const ProductPage: React.FC = () => {
  const { project, mediaUrls, isLoading } = useProductProject()
  const {
    currentPageIndex,
    currentPage,
    mountedPages,
    goToNextPage,
    goToPreviousPage,
    goToHome,
    goToPage,
  } = usePageNavigation(project)

  const [exitConfirm, setExitConfirm] = useState(false)
  const [showEntryPage, setShowEntryPage] = useState(true)
  const [resumePlaybackSignal, setResumePlaybackSignal] = useState(0)

  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!project) return

      // 종료 키 확인
      if (project.settings.exitKey && e.key === project.settings.exitKey) {
        setExitConfirm(true)
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
  }, [project, currentPageIndex, goToNextPage, goToPreviousPage, goToHome])

  const handleVideoEnd = () => {
    // 단일 재생 모드일 때만 자동으로 다음 페이지로
    if (project?.pages[currentPageIndex]?.playType === 'single') {
      goToNextPage()
    }
  }

  const handleButtonClick = (buttonId: string) => {
    if (!project) return

    const page = project.pages[currentPageIndex]
    const button = page.buttons.find((b) => b.id === buttonId)

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

    const page = project.pages[currentPageIndex]
    const touchArea = page.touchAreas.find((t) => t.id === touchAreaId)

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

  const handleStartClick = () => {
    setShowEntryPage(false)
    // 사용자 클릭 이후 재생 재시도를 위해 신호 증가
    setResumePlaybackSignal((prev) => prev + 1)
  }

  // 로딩 중
  if (isLoading) {
    return <LoadingScreen />
  }

  // 프로젝트 없음
  if (!project) {
    return (
      <ErrorScreen
        title='프로젝트를 찾을 수 없습니다'
        message='빌더 페이지에서 프로젝트를 먼저 만들어주세요'
      />
    )
  }

  // 페이지 없음
  if (project.pages.length === 0) {
    return (
      <ErrorScreen
        title='페이지가 없습니다'
        message='빌더 페이지에서 페이지를 추가해주세요'
      />
    )
  }

  return (
    <div className='relative h-screen w-screen overflow-hidden bg-black'>
      {/* 종료 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={exitConfirm}
        title='앱 종료'
        message='앱을 종료하시겠습니까?'
        confirmText='종료'
        cancelText='취소'
        onConfirm={() => window.close()}
        onCancel={() => setExitConfirm(false)}
        variant='warning'
      />

      {/* 입구 페이지 */}
      {showEntryPage && (
        <EntryPage projectName={project.name} onStart={handleStartClick} />
      )}

      {/* 마운트된 모든 페이지 렌더링 (프리로딩) */}
      {!showEntryPage &&
        Array.from(mountedPages).map((pageIndex) => {
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
                onTouchAreaClick={
                  isCurrentPage ? handleTouchAreaClick : () => {}
                }
                isActive={isCurrentPage}
                resumeSignal={resumePlaybackSignal}
              />
            </div>
          )
        })}

      {/* 미디어 로드 실패 시 */}
      {!showEntryPage &&
      (!currentPage || !mediaUrls[currentPage?.mediaId || '']) ? (
        <div className='absolute inset-0 z-20 flex h-full w-full items-center justify-center text-white'>
          <p>미디어를 로드할 수 없습니다</p>
        </div>
      ) : null}

      {/* 컨트롤 오버레이 */}
      {!showEntryPage && (
        <ControlOverlay
          settings={project.settings}
          currentPageIndex={currentPageIndex}
          totalPages={project.pages.length}
          onPrevious={goToPreviousPage}
          onHome={goToHome}
        />
      )}
    </div>
  )
}

export default ProductPage
