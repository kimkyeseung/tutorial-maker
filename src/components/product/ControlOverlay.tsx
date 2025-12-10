import React from 'react'
import type { ProjectSettings } from '../../types/project'

type ControlOverlayProps = {
  settings: ProjectSettings
  currentPageIndex: number
  totalPages: number
  onPrevious: () => void
  onHome: () => void
}

const ControlOverlay: React.FC<ControlOverlayProps> = ({
  settings,
  currentPageIndex,
  totalPages,
  onPrevious,
  onHome,
}) => {
  return (
    <>
      {/* 네비게이션 버튼 */}
      {(settings.showBackButton || settings.showHomeButton) && (
        <div className='absolute bottom-8 left-1/2 z-30 flex -translate-x-1/2 transform gap-4'>
          {settings.showBackButton && currentPageIndex > 0 && (
            <button
              onClick={onPrevious}
              className='rounded-lg bg-gray-800 bg-opacity-80 px-6 py-3 text-white shadow-lg transition-all hover:bg-opacity-100'
            >
              ← 이전
            </button>
          )}

          {settings.showHomeButton && (
            <button
              onClick={onHome}
              className='rounded-lg bg-gray-800 bg-opacity-80 px-6 py-3 text-white shadow-lg transition-all hover:bg-opacity-100'
            >
              🏠 처음으로
            </button>
          )}
        </div>
      )}

      {/* 진행 상황 표시 */}
      {settings.showProgress && (
        <div className='absolute right-4 top-4 z-30 rounded-lg bg-gray-800 bg-opacity-80 px-4 py-2 text-white shadow-lg'>
          {currentPageIndex + 1} / {totalPages}
        </div>
      )}

      {/* 종료 키 안내 */}
      {settings.exitKey && (
        <div className='absolute left-4 top-4 z-30 rounded bg-gray-800 bg-opacity-80 px-3 py-1 text-xs text-white'>
          {settings.exitKey} 키로 종료
        </div>
      )}
    </>
  )
}

export default ControlOverlay
