import React, { useRef, useEffect, useState } from 'react'
import type { Page } from '../../types/project'
import PageButton from './PageButton'
import TouchAreaComponent from './TouchAreaComponent'

type VideoPlayerProps = {
  page: Page
  mediaUrl: string
  buttonImageUrls?: Record<string, string>
  onVideoEnd: () => void
  onButtonClick: (buttonId: string) => void
  onTouchAreaClick: (touchAreaId: string) => void
  isActive?: boolean
  resumeSignal?: number
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  page,
  mediaUrl,
  buttonImageUrls = {},
  onVideoEnd,
  onButtonClick,
  onTouchAreaClick,
  isActive = true,
  resumeSignal = 0,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [hasEnded, setHasEnded] = useState(false)
  const [currentPlayCount, setCurrentPlayCount] = useState(0) // ?„ì¬ ?¬ìƒ ?Ÿìˆ˜

  // ?œì„± ?íƒœê°€ ?˜ë©´ ë¹„ë””???¬ìƒ, ë¹„í™œ?±í™”?˜ë©´ ?¼ì‹œ?•ì?
  useEffect(() => {
    if (page.mediaType === 'video' && videoRef.current && mediaUrl) {
      if (isActive) {
        setHasEnded(false)
        setCurrentPlayCount(0) // ?¬ìƒ ?Ÿìˆ˜ ì´ˆê¸°??        videoRef.current.currentTime = 0
        videoRef.current.play().catch((err) => {
          console.error('Failed to play video:', err)
        })
      } else {
        videoRef.current.pause()
      }
    }
  }, [isActive, page.mediaType, mediaUrl])

  // ë¯¸ë””??URL ë³€ê²???ë¡œë“œ
  useEffect(() => {
    if (page.mediaType === 'video' && videoRef.current) {
      videoRef.current.load()
    }
  }, [mediaUrl, page.mediaType])

  // ?¬ìš©???í˜¸?‘ìš© ?´í›„ ?¬ìƒ???¤ì‹œ ?œë„ (ë¹Œë“œ ???ë™?¬ìƒ ì°¨ë‹¨ ?€??
  useEffect(() => {
    if (
      page.mediaType !== 'video' ||
      !isActive ||
      !videoRef.current ||
      !mediaUrl
    ) {
      return
    }

    videoRef.current.play().catch((err) => {
      console.error('Failed to resume video after user action:', err)
    })
  }, [resumeSignal, isActive, page.mediaType, mediaUrl])

  const handleVideoEnded = () => {
    setHasEnded(true)

    if (page.playType === 'single') {
      const targetCount = page.playCount || 1
      const newCount = currentPlayCount + 1

      if (newCount >= targetCount) {
        // ëª©í‘œ ?¬ìƒ ?Ÿìˆ˜???„ë‹¬?˜ë©´ ?¤ìŒ ?˜ì´ì§€ë¡??´ë™
        onVideoEnd()
      } else {
        // ?„ì§ ?¬ìƒ ?Ÿìˆ˜ê°€ ?¨ì•˜?¼ë©´ ?¤ì‹œ ?¬ìƒ
        setCurrentPlayCount(newCount)
        setHasEnded(false)
        if (videoRef.current) {
          videoRef.current.currentTime = 0
          videoRef.current.play()
        }
      }
    } else {
      // loop ëª¨ë“œ: ë¬´í•œ ë°˜ë³µ ?¬ìƒ
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

      {/* ë¹„ë””??ì¢…ë£Œ ?íƒœ ?œì‹œ (?”ë²„ê¹…ìš©) */}
      {hasEnded && page.playType === 'loop' && (
        <div className='absolute right-4 top-4 rounded bg-green-500 px-3 py-1 text-sm text-white opacity-50'>
          ë°˜ë³µ ?¬ìƒ ì¤?        </div>
      )}

      {/* ë²„íŠ¼ ?Œë”ë§?*/}
      {page.buttons.map((button) => {
        const isVisible =
          button.showTiming === 'immediate' ||
          (button.showTiming === 'after-video' && hasEnded)

        return (
          <PageButton
            key={button.id}
            button={button}
            imageUrl={buttonImageUrls[button.imageId]}
            onClick={() => onButtonClick(button.id)}
            isVisible={isVisible}
          />
        )
      })}

      {/* ?°ì¹˜ ?ì—­ ?Œë”ë§?*/}
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
