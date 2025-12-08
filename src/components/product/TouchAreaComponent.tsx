import React from 'react'
import type { TouchArea } from '../../types/project'

type TouchAreaProps = {
  touchArea: TouchArea
  onClick: () => void
  isVisible: boolean
}

const TouchAreaComponent: React.FC<TouchAreaProps> = ({
  touchArea,
  onClick,
  isVisible,
}) => {
  if (!isVisible) return null

  return (
    <button
      onClick={onClick}
      className='absolute cursor-pointer transition-opacity hover:bg-white hover:bg-opacity-10'
      style={{
        left: `${touchArea.position.x}%`,
        top: `${touchArea.position.y}%`,
        width: `${touchArea.size.width}%`,
        height: `${touchArea.size.height}%`,
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
      }}
      aria-label='Touch area'
    />
  )
}

export default TouchAreaComponent
