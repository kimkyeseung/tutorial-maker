import React, { useState, useRef } from 'react'
import type { TouchArea } from '../../types/project'

type TouchAreaEditorProps = {
  touchAreas: TouchArea[]
  onUpdate: (touchAreas: TouchArea[]) => void
  mediaUrl: string | null
  totalPages: number
}

const TouchAreaEditor: React.FC<TouchAreaEditorProps> = ({
  touchAreas,
  onUpdate,
  mediaUrl,
  totalPages,
}) => {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleAddTouchArea = () => {
    const newArea: TouchArea = {
      id: crypto.randomUUID(),
      position: { x: 50, y: 50 },
      size: { width: 20, height: 15 },
      action: { type: 'next' },
      showTiming: 'immediate',
    }

    onUpdate([...touchAreas, newArea])
    setSelectedAreaId(newArea.id)
  }

  const handleDeleteArea = (areaId: string) => {
    onUpdate(touchAreas.filter((a) => a.id !== areaId))
    if (selectedAreaId === areaId) {
      setSelectedAreaId(null)
    }
  }

  const handleAreaUpdate = (areaId: string, updates: Partial<TouchArea>) => {
    onUpdate(
      touchAreas.map((a) => (a.id === areaId ? { ...a, ...updates } : a))
    )
  }

  const handleMouseDown = (areaId: string, e: React.MouseEvent) => {
    if (!containerRef.current) return
    e.stopPropagation()

    setSelectedAreaId(areaId)

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

      handleAreaUpdate(areaId, {
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

  const handleResizeMouseDown = (areaId: string, e: React.MouseEvent) => {
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

      handleAreaUpdate(areaId, {
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

  const selectedArea = touchAreas.find((a) => a.id === selectedAreaId)

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>
          터치 영역 ({touchAreas.length}개)
        </h3>
        <button
          onClick={handleAddTouchArea}
          className='rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700'
        >
          + 터치 영역 추가
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

        {touchAreas.map((area) => (
          <div
            key={area.id}
            onMouseDown={(e) => handleMouseDown(area.id, e)}
            className={`absolute cursor-move border-2 border-dashed ${
              selectedAreaId === area.id
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
            {/* 중앙 라벨 */}
            <div className='absolute inset-0 flex items-center justify-center'>
              <span className='rounded bg-purple-600 px-2 py-1 text-xs font-bold text-white'>
                터치 영역
              </span>
            </div>

            {/* 리사이즈 핸들 */}
            {selectedAreaId === area.id && (
              <div
                onMouseDown={(e) => handleResizeMouseDown(area.id, e)}
                className='absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-purple-600'
              />
            )}
          </div>
        ))}
      </div>

      {/* 터치 영역 설정 */}
      {selectedArea && (
        <div className='space-y-4 border-t pt-4'>
          <h4 className='font-medium'>선택된 터치 영역 설정</h4>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                위치 X (%)
              </label>
              <input
                type='number'
                value={Math.round(selectedArea.position.x)}
                onChange={(e) =>
                  handleAreaUpdate(selectedArea.id, {
                    position: {
                      ...selectedArea.position,
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
                value={Math.round(selectedArea.position.y)}
                onChange={(e) =>
                  handleAreaUpdate(selectedArea.id, {
                    position: {
                      ...selectedArea.position,
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
                value={Math.round(selectedArea.size.width)}
                onChange={(e) =>
                  handleAreaUpdate(selectedArea.id, {
                    size: {
                      ...selectedArea.size,
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
                value={Math.round(selectedArea.size.height)}
                onChange={(e) =>
                  handleAreaUpdate(selectedArea.id, {
                    size: {
                      ...selectedArea.size,
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
              value={selectedArea.action.type}
              onChange={(e) => {
                const type = e.target.value as 'next' | 'goto'
                handleAreaUpdate(selectedArea.id, {
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

          {selectedArea.action.type === 'goto' && (
            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                이동할 페이지
              </label>
              <input
                type='number'
                value={
                  selectedArea.action.targetPageId
                    ? parseInt(selectedArea.action.targetPageId) + 1
                    : 1
                }
                onChange={(e) =>
                  handleAreaUpdate(selectedArea.id, {
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
              value={selectedArea.showTiming}
              onChange={(e) =>
                handleAreaUpdate(selectedArea.id, {
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
            onClick={() => handleDeleteArea(selectedArea.id)}
            className='w-full rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700'
          >
            터치 영역 삭제
          </button>
        </div>
      )}

      {touchAreas.length === 0 && (
        <p className='py-4 text-center text-sm text-gray-500'>
          터치 영역을 추가하려면 위의 "+ 터치 영역 추가"를 클릭하세요
        </p>
      )}
    </div>
  )
}

export default TouchAreaEditor
