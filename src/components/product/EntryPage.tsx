import React, { useState, useEffect } from 'react'

type EntryPageProps = {
  projectName: string
  onStart: () => void
}

// 전체화면 토글 함수
const toggleFullscreen = async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (err) {
    console.error('전체화면 전환 실패:', err)
  }
}

const EntryPage: React.FC<EntryPageProps> = ({ projectName, onStart }) => {
  const [isFullscreen, setIsFullscreen] = useState(false)

  // 전체화면 상태 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleToggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation() // 부모 onClick 방지
    toggleFullscreen()
  }

  return (
    <div
      className='absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
      onClick={onStart}
    >
      {/* 전체화면 토글 버튼 */}
      <button
        onClick={handleToggleFullscreen}
        className='absolute right-4 top-4 rounded-lg bg-gray-700 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-600'
        title={isFullscreen ? '전체화면 종료 (⌘+1)' : '전체화면 (⌘+1)'}
      >
        {isFullscreen ? '⛶ 창모드' : '⛶ 전체화면'}
      </button>

      <h1 className='mb-8 text-4xl font-bold text-white'>{projectName}</h1>
      <button
        onClick={onStart}
        className='rounded-xl bg-blue-600 px-12 py-4 text-xl font-semibold text-white shadow-lg transition-all hover:bg-blue-500 hover:shadow-xl active:scale-95'
      >
        시작하기
      </button>
      <p className='mt-6 text-sm text-gray-400'>
        화면을 터치하거나 버튼을 클릭하세요
      </p>
    </div>
  )
}

export default EntryPage
