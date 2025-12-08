import React, { useState, useRef } from 'react'
import type { PageButton, NavigationAction } from '../../types/project'
import {
  saveButtonImage,
  getButtonImage,
  createBlobURL,
} from '../../utils/mediaStorage'

type ButtonEditorProps = {
  buttons: PageButton[]
  onUpdate: (buttons: PageButton[]) => void
  mediaUrl: string | null
  totalPages: number
}

const ButtonEditor: React.FC<ButtonEditorProps> = ({
  buttons,
  onUpdate,
  mediaUrl,
  totalPages,
}) => {
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [buttonImages, setButtonImages] = useState<Record<string, string>>({})

  const loadButtonImage = async (imageId: string) => {
    const image = await getButtonImage(imageId)
    if (image) {
      setButtonImages((prev) => ({
        ...prev,
        [imageId]: createBlobURL(image.blob),
      }))
    }
  }

  const handleAddButton = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const imageId = await saveButtonImage(file)
      await loadButtonImage(imageId)

      const newButton: PageButton = {
        id: crypto.randomUUID(),
        imageId,
        position: { x: 50, y: 50 }, // 중앙에 생성
        size: { width: 15, height: 10 }, // 기본 크기 (%)
        action: { type: 'next' },
        showTiming: 'immediate',
      }

      onUpdate([...buttons, newButton])
      setSelectedButtonId(newButton.id)
    }

    input.click()
  }

  const handleDeleteButton = (buttonId: string) => {
    onUpdate(buttons.filter((b) => b.id !== buttonId))
    if (selectedButtonId === buttonId) {
      setSelectedButtonId(null)
    }
  }

  const handleButtonUpdate = (
    buttonId: string,
    updates: Partial<PageButton>
  ) => {
    onUpdate(buttons.map((b) => (b.id === buttonId ? { ...b, ...updates } : b)))
  }

  const handleMouseDown = (buttonId: string, e: React.MouseEvent) => {
    if (!containerRef.current) return
    e.stopPropagation()

    setSelectedButtonId(buttonId)
    setIsDragging(true)

    const button = buttons.find((b) => b.id === buttonId)
    if (!button) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const startPosX = button.position.x
    const startPosY = button.position.y

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = ((e.clientX - startX) / rect.width) * 100
      const deltaY = ((e.clientY - startY) / rect.height) * 100

      handleButtonUpdate(buttonId, {
        position: {
          x: Math.max(0, Math.min(100 - button.size.width, startPosX + deltaX)),
          y: Math.max(
            0,
            Math.min(100 - button.size.height, startPosY + deltaY)
          ),
        },
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleResizeMouseDown = (buttonId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)

    const button = buttons.find((b) => b.id === buttonId)
    if (!button || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = button.size.width
    const startHeight = button.size.height

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = ((e.clientX - startX) / rect.width) * 100
      const deltaY = ((e.clientY - startY) / rect.height) * 100

      handleButtonUpdate(buttonId, {
        size: {
          width: Math.max(5, Math.min(50, startWidth + deltaX)),
          height: Math.max(5, Math.min(50, startHeight + deltaY)),
        },
      })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const selectedButton = buttons.find((b) => b.id === selectedButtonId)

  // 버튼 이미지 로드
  React.useEffect(() => {
    buttons.forEach((button) => {
      if (button.imageId && !buttonImages[button.imageId]) {
        loadButtonImage(button.imageId)
      }
    })
  }, [buttons])

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>버튼 ({buttons.length}개)</h3>
        <button
          onClick={handleAddButton}
          className='rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700'
        >
          + 버튼 추가
        </button>
      </div>

      {/* 미리보기 영역 */}
      <div
        ref={containerRef}
        className='relative mb-4 aspect-video w-full overflow-hidden rounded-lg bg-gray-900'
        style={{
          backgroundImage: mediaUrl ? `url(${mediaUrl})` : undefined,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {!mediaUrl && (
          <div className='absolute inset-0 flex items-center justify-center text-gray-500'>
            미디어를 먼저 추가하세요
          </div>
        )}

        {buttons.map((button) => (
          <div
            key={button.id}
            onMouseDown={(e) => handleMouseDown(button.id, e)}
            className={`absolute cursor-move ${
              selectedButtonId === button.id ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{
              left: `${button.position.x}%`,
              top: `${button.position.y}%`,
              width: `${button.size.width}%`,
              height: `${button.size.height}%`,
              backgroundImage: buttonImages[button.imageId]
                ? `url(${buttonImages[button.imageId]})`
                : undefined,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              backgroundColor: !buttonImages[button.imageId]
                ? 'rgba(59, 130, 246, 0.5)'
                : undefined,
            }}
          >
            {/* 리사이즈 핸들 */}
            {selectedButtonId === button.id && (
              <div
                onMouseDown={(e) => handleResizeMouseDown(button.id, e)}
                className='absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-blue-500'
              />
            )}
          </div>
        ))}
      </div>

      {/* 버튼 설정 */}
      {selectedButton && (
        <div className='space-y-4 border-t pt-4'>
          <h4 className='font-medium'>선택된 버튼 설정</h4>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                위치 X (%)
              </label>
              <input
                type='number'
                value={Math.round(selectedButton.position.x)}
                onChange={(e) =>
                  handleButtonUpdate(selectedButton.id, {
                    position: {
                      ...selectedButton.position,
                      x: parseFloat(e.target.value),
                    },
                  })
                }
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
                min='0'
                max='100'
              />
            </div>

            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                위치 Y (%)
              </label>
              <input
                type='number'
                value={Math.round(selectedButton.position.y)}
                onChange={(e) =>
                  handleButtonUpdate(selectedButton.id, {
                    position: {
                      ...selectedButton.position,
                      y: parseFloat(e.target.value),
                    },
                  })
                }
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
                min='0'
                max='100'
              />
            </div>

            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                크기 너비 (%)
              </label>
              <input
                type='number'
                value={Math.round(selectedButton.size.width)}
                onChange={(e) =>
                  handleButtonUpdate(selectedButton.id, {
                    size: {
                      ...selectedButton.size,
                      width: parseFloat(e.target.value),
                    },
                  })
                }
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
                min='5'
                max='50'
              />
            </div>

            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                크기 높이 (%)
              </label>
              <input
                type='number'
                value={Math.round(selectedButton.size.height)}
                onChange={(e) =>
                  handleButtonUpdate(selectedButton.id, {
                    size: {
                      ...selectedButton.size,
                      height: parseFloat(e.target.value),
                    },
                  })
                }
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
                min='5'
                max='50'
              />
            </div>
          </div>

          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700'>
              클릭 시 동작
            </label>
            <select
              value={selectedButton.action.type}
              onChange={(e) => {
                const type = e.target.value as 'next' | 'goto'
                handleButtonUpdate(selectedButton.id, {
                  action:
                    type === 'next'
                      ? { type: 'next' }
                      : { type: 'goto', targetPageId: undefined },
                })
              }}
              className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
            >
              <option value='next'>다음 페이지</option>
              <option value='goto'>특정 페이지로</option>
            </select>
          </div>

          {selectedButton.action.type === 'goto' && (
            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                이동할 페이지
              </label>
              <input
                type='number'
                value={
                  selectedButton.action.targetPageId
                    ? parseInt(selectedButton.action.targetPageId) + 1
                    : 1
                }
                onChange={(e) =>
                  handleButtonUpdate(selectedButton.id, {
                    action: {
                      type: 'goto',
                      targetPageId: (parseInt(e.target.value) - 1).toString(),
                    },
                  })
                }
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
                min='1'
                max={totalPages}
              />
            </div>
          )}

          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700'>
              표시 타이밍
            </label>
            <select
              value={selectedButton.showTiming}
              onChange={(e) =>
                handleButtonUpdate(selectedButton.id, {
                  showTiming: e.target.value as 'immediate' | 'after-video',
                })
              }
              className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
            >
              <option value='immediate'>즉시 표시</option>
              <option value='after-video'>영상 종료 후</option>
            </select>
          </div>

          <button
            onClick={() => handleDeleteButton(selectedButton.id)}
            className='w-full rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700'
          >
            버튼 삭제
          </button>
        </div>
      )}

      {buttons.length === 0 && (
        <p className='py-4 text-center text-sm text-gray-500'>
          버튼을 추가하려면 위의 "+ 버튼 추가"를 클릭하세요
        </p>
      )}
    </div>
  )
}

export default ButtonEditor
