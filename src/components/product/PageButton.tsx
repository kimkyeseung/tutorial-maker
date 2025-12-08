import React, { useState, useEffect } from 'react'
import type { PageButton } from '../../types/project'
import { getButtonImage, createBlobURL } from '../../utils/mediaStorage'

type PageButtonProps = {
  button: PageButton
  onClick: () => void
  isVisible: boolean
}

const PageButtonComponent: React.FC<PageButtonProps> = ({
  button,
  onClick,
  isVisible,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    loadButtonImage()
  }, [button.imageId])

  const loadButtonImage = async () => {
    const image = await getButtonImage(button.imageId)
    if (image) {
      setImageUrl(createBlobURL(image.blob))
    }
  }

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
