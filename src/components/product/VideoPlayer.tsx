import React, { useRef, useEffect, useState } from 'react'
import type { Page } from '../../types/project'
import PageButton from './PageButton'
import TouchAreaComponent from './TouchAreaComponent'

type VideoPlayerProps = {
  page: Page
  mediaUrl: string
  onVideoEnd: () => void
  onButtonClick: (buttonId: string) => void
  onTouchAreaClick: (touchAreaId: string) => void
  isActive?: boolean
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  page,
  mediaUrl,
  onVideoEnd,
  onButtonClick,
  onTouchAreaClick,
  isActive = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [hasEnded, setHasEnded] = useState(false)

  // 활성 상태가 되면 비디오 재생, 비활성화되면 일시정지
  useEffect(() => {
    if (page.mediaType === 'video' && videoRef.current) {
      if (isActive) {
        setHasEnded(false)
        videoRef.current.currentTime = 0
        videoRef.current.play().catch((err) => {
          console.error('Failed to play video:', err)
        })
      } else {
        videoRef.current.pause()
      }
    }
  }, [isActive, page.mediaType])

  // 미디어 URL 변경 시 로드
  useEffect(() => {
    if (page.mediaType === 'video' && videoRef.current) {
      videoRef.current.load()
    }
  }, [mediaUrl, page.mediaType])

  const handleVideoEnded = () => {
    setHasEnded(true)

    if (page.playType === 'single') {
      onVideoEnd()
    } else {
      // loop 모드: 자동 재생
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.play()
      }
    }
  }

  return (
    <div className='absolute inset-0 h-full w-full bg-black'>
      {page.mediaType === 'video' ? (
        <video
          ref={videoRef}
          className='h-full w-full object-contain'
          onEnded={handleVideoEnded}
          playsInline
        >
          <source src={mediaUrl} type='video/mp4' />
          <source src={mediaUrl} type='video/webm' />
        </video>
      ) : (
        <img
          ref={imageRef}
          src={mediaUrl}
          alt='Page content'
          className='h-full w-full object-contain'
        />
      )}

      {/* 비디오 종료 상태 표시 (디버깅용) */}
      {hasEnded && page.playType === 'loop' && (
        <div className='absolute right-4 top-4 rounded bg-green-500 px-3 py-1 text-sm text-white opacity-50'>
          반복 재생 중
        </div>
      )}

      {/* 버튼 렌더링 */}
      {page.buttons.map((button) => {
        const isVisible =
          button.showTiming === 'immediate' ||
          (button.showTiming === 'after-video' && hasEnded)

        return (
          <PageButton
            key={button.id}
            button={button}
            onClick={() => onButtonClick(button.id)}
            isVisible={isVisible}
          />
        )
      })}

      {/* 터치 영역 렌더링 */}
      {page.touchAreas.map((touchArea) => {
        const isVisible =
          touchArea.showTiming === 'immediate' ||
          (touchArea.showTiming === 'after-video' && hasEnded)

        return (
          <TouchAreaComponent
            key={touchArea.id}
            touchArea={touchArea}
            onClick={() => onTouchAreaClick(touchArea.id)}
            isVisible={isVisible}
          />
        )
      })}
    </div>
  )
}

export default VideoPlayer
