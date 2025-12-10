import React, { useState, useEffect } from 'react'
import type { PageButton } from '../../types/project'
import { getButtonImage, createBlobURL } from '../../utils/mediaStorage'

type PageButtonProps = {
  button: PageButton
  imageUrl?: string // 외부에서 전달받은 이미지 URL (프로덕트 모드용)
  onClick: () => void
  isVisible: boolean
}

const PageButtonComponent: React.FC<PageButtonProps> = ({
  button,
  imageUrl: externalImageUrl,
  onClick,
  isVisible,
}) => {
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null)

  // 외부 URL이 없을 때만 IndexedDB에서 로드 (개발 모드)
  useEffect(() => {
    if (!externalImageUrl) {
      loadButtonImage()
    }
  }, [button.imageId, externalImageUrl])

  const loadButtonImage = async () => {
    const image = await getButtonImage(button.imageId)
    if (image) {
      setLocalImageUrl(createBlobURL(image.blob))
    }
  }

  // 외부 URL 우선, 없으면 로컬 URL 사용
  const imageUrl = externalImageUrl || localImageUrl

  if (!isVisible) return null

  return (
    <button
      onClick={onClick}
      className='absolute cursor-pointer transition-transform hover:scale-105 active:scale-95'
      style={{
        left: `${button.position.x}%`,
        top: `${button.position.y}%`,
        width: `${button.size.width}%`,
        height: `${button.size.height}%`,
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: !imageUrl ? 'rgba(59, 130, 246, 0.7)' : 'transparent',
        border: 'none',
        outline: 'none',
      }}
      aria-label='Navigation button'
    />
  )
}

export default PageButtonComponent
