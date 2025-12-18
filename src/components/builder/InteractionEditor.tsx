import React, { useState, useRef, useEffect } from 'react'
import type { PageButton, TouchArea } from '../../types/project'
import {
  saveButtonImage,
  getButtonImage,
  createBlobURL,
} from '../../utils/mediaStorage'

type InteractionEditorProps = {
  buttons: PageButton[]
  touchAreas: TouchArea[]
  onUpdateButtons: (buttons: PageButton[]) => void
  onUpdateTouchAreas: (touchAreas: TouchArea[]) => void
  mediaUrl: string | null
  mediaType: 'video' | 'image'
  totalPages: number
}

type SelectedItem =
  | { type: 'button'; id: string }
  | { type: 'touchArea'; id: string }
  | null

const InteractionEditor: React.FC<InteractionEditorProps> = ({
  buttons,
  touchAreas,
  onUpdateButtons,
  onUpdateTouchAreas,
  mediaUrl,
  mediaType,
  totalPages,
}) => {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [buttonImages, setButtonImages] = useState<Record<string, string>>({})

  // 버튼 이미지 로드
  const loadButtonImage = async (imageId: string) => {
    const image = await getButtonImage(imageId)
    if (image) {
      setButtonImages((prev) => ({
        ...prev,
        [imageId]: createBlobURL(image.blob),
      }))
    }
  }

  useEffect(() => {
    buttons.forEach((button) => {
      if (button.imageId && !buttonImages[button.imageId]) {
        loadButtonImage(button.imageId)
      }
    })
  }, [buttons])

  // 버튼 추가
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
        position: { x: 50, y: 50 },
        size: { width: 15, height: 10 },
        action: { type: 'next' },
        showTiming: 'immediate',
      }

      onUpdateButtons([...buttons, newButton])
      setSelectedItem({ type: 'button', id: newButton.id })
    }

    input.click()
  }

  // 터치 영역 추가
  const handleAddTouchArea = () => {
    const newArea: TouchArea = {
      id: crypto.randomUUID(),
      position: { x: 50, y: 50 },
      size: { width: 20, height: 15 },
      action: { type: 'next' },
      showTiming: 'immediate',
    }

    onUpdateTouchAreas([...touchAreas, newArea])
    setSelectedItem({ type: 'touchArea', id: newArea.id })
  }

  // 버튼 삭제
  const handleDeleteButton = (buttonId: string) => {
    onUpdateButtons(buttons.filter((b) => b.id !== buttonId))
    if (selectedItem?.type === 'button' && selectedItem.id === buttonId) {
      setSelectedItem(null)
    }
  }

  // 터치 영역 삭제
  const handleDeleteTouchArea = (areaId: string) => {
    onUpdateTouchAreas(touchAreas.filter((a) => a.id !== areaId))
    if (selectedItem?.type === 'touchArea' && selectedItem.id === areaId) {
      setSelectedItem(null)
    }
  }

  // 버튼 업데이트
  const handleButtonUpdate = (buttonId: string, updates: Partial<PageButton>) => {
    onUpdateButtons(buttons.map((b) => (b.id === buttonId ? { ...b, ...updates } : b)))
  }

  // 터치 영역 업데이트
  const handleTouchAreaUpdate = (areaId: string, updates: Partial<TouchArea>) => {
    onUpdateTouchAreas(touchAreas.map((a) => (a.id === areaId ? { ...a, ...updates } : a)))
  }

  // 버튼 드래그
  const handleButtonMouseDown = (buttonId: string, e: React.MouseEvent) => {
    if (!containerRef.current) return
    e.stopPropagation()

    setSelectedItem({ type: 'button', id: buttonId })

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
          y: Math.max(0, Math.min(100 - button.size.height, startPosY + deltaY)),
        },
      })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // 버튼 리사이즈
  const handleButtonResizeMouseDown = (buttonId: string, e: React.MouseEvent) => {
    e.stopPropagation()

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
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // 터치 영역 드래그
  const handleTouchAreaMouseDown = (areaId: string, e: React.MouseEvent) => {
    if (!containerRef.current) return
    e.stopPropagation()

    setSelectedItem({ type: 'touchArea', id: areaId })

    const area = touchAreas.find((a) => a.id === areaId)
    if (!area) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const startPosX = area.position.x
    const startPosY = area.position.y

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = ((e.clientX - startX) / rect.width) * 100
      const deltaY = ((e.clientY - startY) / rect.height) * 100

      handleTouchAreaUpdate(areaId, {
        position: {
          x: Math.max(0, Math.min(100 - area.size.width, startPosX + deltaX)),
          y: Math.max(0, Math.min(100 - area.size.height, startPosY + deltaY)),
        },
      })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // 터치 영역 리사이즈
  const handleTouchAreaResizeMouseDown = (areaId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    const area = touchAreas.find((a) => a.id === areaId)
    if (!area || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = area.size.width
    const startHeight = area.size.height

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = ((e.clientX - startX) / rect.width) * 100
      const deltaY = ((e.clientY - startY) / rect.height) * 100

      handleTouchAreaUpdate(areaId, {
        size: {
          width: Math.max(5, Math.min(80, startWidth + deltaX)),
          height: Math.max(5, Math.min(80, startHeight + deltaY)),
        },
      })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // 선택된 아이템 가져오기
  const selectedButton = selectedItem?.type === 'button'
    ? buttons.find((b) => b.id === selectedItem.id)
    : null
  const selectedTouchArea = selectedItem?.type === 'touchArea'
    ? touchAreas.find((a) => a.id === selectedItem.id)
    : null

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      {/* 헤더 */}
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>
          인터랙션 (버튼 {buttons.length}개, 터치 영역 {touchAreas.length}개)
        </h3>
        <div className='flex gap-2'>
          <button
            onClick={handleAddButton}
            className='rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700'
          >
            + 버튼
          </button>
          <button
            onClick={handleAddTouchArea}
            className='rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700'
          >
            + 터치 영역
          </button>
        </div>
      </div>

      {/* 미리보기 영역 */}
      <div
        ref={containerRef}
        className='relative mb-4 aspect-video w-full overflow-hidden rounded-lg bg-gray-900'
        onClick={() => setSelectedItem(null)}
      >
        {/* 배경 미디어 */}
        {mediaUrl && mediaType === 'video' ? (
          <video
            src={mediaUrl}
            className='pointer-events-none absolute inset-0 h-full w-full object-contain'
            muted
          />
        ) : mediaUrl && mediaType === 'image' ? (
          <img
            src={mediaUrl}
            alt='Background'
            className='pointer-events-none absolute inset-0 h-full w-full object-contain'
          />
        ) : (
          <div className='absolute inset-0 flex items-center justify-center text-gray-500'>
            미디어를 먼저 추가하세요
          </div>
        )}

        {/* 터치 영역 (버튼 아래에 표시) */}
        {touchAreas.map((area) => (
          <div
            key={area.id}
            onMouseDown={(e) => handleTouchAreaMouseDown(area.id, e)}
            onClick={(e) => e.stopPropagation()}
            className={`absolute cursor-move border-2 border-dashed ${
              selectedItem?.type === 'touchArea' && selectedItem.id === area.id
                ? 'border-purple-500 bg-purple-500 bg-opacity-30'
                : 'border-purple-300 bg-purple-300 bg-opacity-20'
            }`}
            style={{
              left: `${area.position.x}%`,
              top: `${area.position.y}%`,
              width: `${area.size.width}%`,
              height: `${area.size.height}%`,
            }}
          >
            <div className='absolute inset-0 flex items-center justify-center'>
              <span className='rounded bg-purple-600 px-2 py-1 text-xs font-bold text-white'>
                터치
              </span>
            </div>
            {selectedItem?.type === 'touchArea' && selectedItem.id === area.id && (
              <div
                onMouseDown={(e) => handleTouchAreaResizeMouseDown(area.id, e)}
                className='absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-purple-600'
              />
            )}
          </div>
        ))}

        {/* 버튼 (터치 영역 위에 표시) */}
        {buttons.map((button) => (
          <div
            key={button.id}
            onMouseDown={(e) => handleButtonMouseDown(button.id, e)}
            onClick={(e) => e.stopPropagation()}
            className={`absolute cursor-move ${
              selectedItem?.type === 'button' && selectedItem.id === button.id
                ? 'ring-2 ring-blue-500'
                : ''
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
            {selectedItem?.type === 'button' && selectedItem.id === button.id && (
              <div
                onMouseDown={(e) => handleButtonResizeMouseDown(button.id, e)}
                className='absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-blue-500'
              />
            )}
          </div>
        ))}
      </div>

      {/* 선택된 버튼 설정 */}
      {selectedButton && (
        <div className='space-y-4 border-t pt-4'>
          <h4 className='font-medium text-blue-600'>선택된 버튼 설정</h4>

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

      {/* 선택된 터치 영역 설정 */}
      {selectedTouchArea && (
        <div className='space-y-4 border-t pt-4'>
          <h4 className='font-medium text-purple-600'>선택된 터치 영역 설정</h4>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                위치 X (%)
              </label>
              <input
                type='number'
                value={Math.round(selectedTouchArea.position.x)}
                onChange={(e) =>
                  handleTouchAreaUpdate(selectedTouchArea.id, {
                    position: {
                      ...selectedTouchArea.position,
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
                value={Math.round(selectedTouchArea.position.y)}
                onChange={(e) =>
                  handleTouchAreaUpdate(selectedTouchArea.id, {
                    position: {
                      ...selectedTouchArea.position,
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
                value={Math.round(selectedTouchArea.size.width)}
                onChange={(e) =>
                  handleTouchAreaUpdate(selectedTouchArea.id, {
                    size: {
                      ...selectedTouchArea.size,
                      width: parseFloat(e.target.value),
                    },
                  })
                }
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
                min='5'
                max='80'
              />
            </div>

            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                크기 높이 (%)
              </label>
              <input
                type='number'
                value={Math.round(selectedTouchArea.size.height)}
                onChange={(e) =>
                  handleTouchAreaUpdate(selectedTouchArea.id, {
                    size: {
                      ...selectedTouchArea.size,
                      height: parseFloat(e.target.value),
                    },
                  })
                }
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
                min='5'
                max='80'
              />
            </div>
          </div>

          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700'>
              클릭 시 동작
            </label>
            <select
              value={selectedTouchArea.action.type}
              onChange={(e) => {
                const type = e.target.value as 'next' | 'goto'
                handleTouchAreaUpdate(selectedTouchArea.id, {
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

          {selectedTouchArea.action.type === 'goto' && (
            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                이동할 페이지
              </label>
              <input
                type='number'
                value={
                  selectedTouchArea.action.targetPageId
                    ? parseInt(selectedTouchArea.action.targetPageId) + 1
                    : 1
                }
                onChange={(e) =>
                  handleTouchAreaUpdate(selectedTouchArea.id, {
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
              value={selectedTouchArea.showTiming}
              onChange={(e) =>
                handleTouchAreaUpdate(selectedTouchArea.id, {
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
            onClick={() => handleDeleteTouchArea(selectedTouchArea.id)}
            className='w-full rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700'
          >
            터치 영역 삭제
          </button>
        </div>
      )}

      {/* 빈 상태 안내 */}
      {buttons.length === 0 && touchAreas.length === 0 && (
        <p className='py-4 text-center text-sm text-gray-500'>
          버튼이나 터치 영역을 추가하려면 위의 버튼을 클릭하세요
        </p>
      )}
    </div>
  )
}

export default InteractionEditor
