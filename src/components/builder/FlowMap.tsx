import React, { useState, useEffect, useRef } from 'react'
import type { Page } from '../../types/project'
import { getMediaFile, createBlobURL } from '../../utils/mediaStorage'
import { validatePage } from '../../utils/pageValidation'

type FlowMapProps = {
  pages: Page[]
  onSelectPage: (pageId: string) => void
  loopAtEnd: boolean
}

type PageThumbnail = {
  pageId: string
  pageIndex: number
  thumbnailUrl: string | null
  mediaType: 'video' | 'image'
}

type FlowConnection = {
  fromPageIndex: number
  toPageIndex: number
  type: 'button' | 'touch' | 'auto' | 'loop'
  label?: string
}

const FlowMap: React.FC<FlowMapProps> = ({ pages, onSelectPage, loopAtEnd }) => {
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([])
  const [connections, setConnections] = useState<FlowConnection[]>([])
  const [hoveredPage, setHoveredPage] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 썸네일 로드
  useEffect(() => {
    const loadThumbnails = async () => {
      const thumbs: PageThumbnail[] = []

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        let thumbnailUrl: string | null = null

        if (page.mediaId) {
          const media = await getMediaFile(page.mediaId)
          if (media) {
            if (page.mediaType === 'image') {
              thumbnailUrl = createBlobURL(media.blob)
            } else if (page.mediaType === 'video') {
              // 비디오의 경우 첫 프레임을 캡처
              thumbnailUrl = await captureVideoThumbnail(media.blob)
            }
          }
        }

        thumbs.push({
          pageId: page.id,
          pageIndex: i,
          thumbnailUrl,
          mediaType: page.mediaType,
        })
      }

      setThumbnails(thumbs)
    }

    loadThumbnails()
  }, [pages])

  // 연결 정보 계산
  useEffect(() => {
    const conns: FlowConnection[] = []

    pages.forEach((page, pageIndex) => {
      // 버튼 연결
      page.buttons.forEach((button) => {
        if (button.action.type === 'next') {
          if (pageIndex < pages.length - 1) {
            conns.push({
              fromPageIndex: pageIndex,
              toPageIndex: pageIndex + 1,
              type: 'button',
              label: '버튼',
            })
          } else if (loopAtEnd) {
            conns.push({
              fromPageIndex: pageIndex,
              toPageIndex: 0,
              type: 'loop',
              label: '처음으로',
            })
          }
        } else if (button.action.type === 'goto' && button.action.targetPageId) {
          const targetIndex = parseInt(button.action.targetPageId)
          if (targetIndex >= 0 && targetIndex < pages.length) {
            conns.push({
              fromPageIndex: pageIndex,
              toPageIndex: targetIndex,
              type: 'button',
              label: `페이지 ${targetIndex + 1}`,
            })
          }
        }
      })

      // 터치 영역 연결
      page.touchAreas.forEach((touchArea) => {
        if (touchArea.action.type === 'next') {
          if (pageIndex < pages.length - 1) {
            conns.push({
              fromPageIndex: pageIndex,
              toPageIndex: pageIndex + 1,
              type: 'touch',
              label: '터치',
            })
          } else if (loopAtEnd) {
            conns.push({
              fromPageIndex: pageIndex,
              toPageIndex: 0,
              type: 'loop',
              label: '처음으로',
            })
          }
        } else if (
          touchArea.action.type === 'goto' &&
          touchArea.action.targetPageId
        ) {
          const targetIndex = parseInt(touchArea.action.targetPageId)
          if (targetIndex >= 0 && targetIndex < pages.length) {
            conns.push({
              fromPageIndex: pageIndex,
              toPageIndex: targetIndex,
              type: 'touch',
              label: `페이지 ${targetIndex + 1}`,
            })
          }
        }
      })

      // 단일 재생 자동 이동
      if (page.playType === 'single' && pageIndex < pages.length - 1) {
        conns.push({
          fromPageIndex: pageIndex,
          toPageIndex: pageIndex + 1,
          type: 'auto',
          label: '자동',
        })
      } else if (page.playType === 'single' && pageIndex === pages.length - 1 && loopAtEnd) {
        conns.push({
          fromPageIndex: pageIndex,
          toPageIndex: 0,
          type: 'loop',
          label: '처음으로',
        })
      }
    })

    // 중복 제거
    const uniqueConns = conns.filter(
      (conn, index, self) =>
        index ===
        self.findIndex(
          (c) =>
            c.fromPageIndex === conn.fromPageIndex &&
            c.toPageIndex === conn.toPageIndex &&
            c.type === conn.type
        )
    )

    setConnections(uniqueConns)
  }, [pages, loopAtEnd])

  // 비디오 썸네일 캡처
  const captureVideoThumbnail = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.src = URL.createObjectURL(blob)
      video.muted = true
      video.currentTime = 0.5

      video.onloadeddata = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 160
        canvas.height = 90
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.7))
        } else {
          resolve('')
        }
        URL.revokeObjectURL(video.src)
      }

      video.onerror = () => {
        resolve('')
      }
    })
  }

  // 화살표 렌더링을 위한 SVG 경로 계산
  const getArrowPath = (
    fromIndex: number,
    toIndex: number,
    type: string
  ): { path: string; color: string; label: string; strokeWidth: number; dashArray?: string } => {
    const cardWidth = 160
    const cardHeight = 90
    const gap = 40
    const rowHeight = cardHeight + 90 // 카드 높이 + 아래 텍스트 + 여백
    const offsetX = 80 // 왼쪽 패딩 오프셋

    const fromCol = fromIndex % 4
    const fromRow = Math.floor(fromIndex / 4)
    const toCol = toIndex % 4
    const toRow = Math.floor(toIndex / 4)

    let color = '#3b82f6' // blue for button
    if (type === 'touch') color = '#8b5cf6' // purple
    if (type === 'auto') color = '#10b981' // green
    if (type === 'loop') color = '#f59e0b' // orange

    // 같은 행의 다음 페이지로 이동 (가로 직선)
    if (toIndex === fromIndex + 1 && fromRow === toRow) {
      const startX = offsetX + fromCol * (cardWidth + gap) + cardWidth
      const startY = fromRow * rowHeight + cardHeight / 2
      const endX = offsetX + toCol * (cardWidth + gap)
      const endY = toRow * rowHeight + cardHeight / 2

      return {
        path: `M ${startX} ${startY} L ${endX - 8} ${endY}`,
        color,
        label: '',
        strokeWidth: 2,
      }
    }

    // 줄 바꿈: 다음 행의 첫 번째 칸으로 이동 (4 -> 5 같은 경우)
    if (toIndex === fromIndex + 1 && toRow === fromRow + 1 && toCol === 0) {
      const startX = offsetX + fromCol * (cardWidth + gap) + cardWidth / 2
      const startY = fromRow * rowHeight + cardHeight
      const endX = offsetX + toCol * (cardWidth + gap) + cardWidth / 2
      const endY = toRow * rowHeight

      // 아래로 내려갔다가 왼쪽으로 꺾어서 다음 행으로
      const midY = startY + (rowHeight - cardHeight) / 2

      return {
        path: `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY - 8}`,
        color,
        label: '',
        strokeWidth: 2,
      }
    }

    // 뒤로 가는 루프 (마지막 -> 처음)
    if (type === 'loop' && toIndex === 0) {
      const startX = offsetX + fromCol * (cardWidth + gap) + cardWidth / 2
      const startY = fromRow * rowHeight + cardHeight
      const endX = offsetX + cardWidth / 2
      const endY = cardHeight / 2

      // 왼쪽 바깥으로 크게 돌아가는 직선 경로 (ㄴ자 형태)
      const loopOffsetX = 30 // 왼쪽 여백
      const bottomY = startY + 25 // 시작점 아래로

      return {
        path: `M ${startX} ${startY} L ${startX} ${bottomY} L ${loopOffsetX} ${bottomY} L ${loopOffsetX} ${endY} L ${endX - 8} ${endY}`,
        color,
        label: '',
        strokeWidth: 3,
        dashArray: '8,4', // 점선으로 루프 강조
      }
    }

    // 일반 점프 (여러 칸 건너뛰기)
    const fromX = offsetX + fromCol * (cardWidth + gap) + cardWidth / 2
    const fromY = fromRow * rowHeight + cardHeight
    const toX = offsetX + toCol * (cardWidth + gap) + cardWidth / 2
    const toY = toRow * rowHeight

    // 같은 행에서 점프하는 경우 - 위쪽으로 곡선
    if (fromRow === toRow) {
      const curveY = fromY - cardHeight - 30
      return {
        path: `M ${fromX} ${fromY - cardHeight - 5} Q ${(fromX + toX) / 2} ${curveY - 20} ${toX} ${toY - 5}`,
        color,
        label: '',
        strokeWidth: 2,
      }
    }

    // 다른 행으로 점프하는 경우
    const midY = Math.max(fromY, toY) + 30
    return {
      path: `M ${fromX} ${fromY} Q ${fromX} ${midY} ${(fromX + toX) / 2} ${midY} Q ${toX} ${midY} ${toX} ${toY + 8}`,
      color,
      label: '',
      strokeWidth: 2,
    }
  }

  if (pages.length === 0) {
    return (
      <div className='rounded-lg bg-white p-8 text-center shadow'>
        <div className='mb-4 text-6xl'>🗺️</div>
        <p className='mb-2 text-gray-600'>페이지 흐름 맵</p>
        <p className='text-sm text-gray-400'>
          페이지를 추가하면 여기에 흐름도가 표시됩니다
        </p>
      </div>
    )
  }

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>페이지 흐름 맵</h3>
        <div className='flex gap-4 text-xs'>
          <span className='flex items-center gap-1'>
            <span className='inline-block h-2 w-4 rounded bg-blue-500'></span>
            버튼
          </span>
          <span className='flex items-center gap-1'>
            <span className='inline-block h-2 w-4 rounded bg-purple-500'></span>
            터치
          </span>
          <span className='flex items-center gap-1'>
            <span className='inline-block h-2 w-4 rounded bg-green-500'></span>
            자동
          </span>
          <span className='flex items-center gap-1'>
            <span className='inline-block h-2 w-4 rounded bg-orange-500'></span>
            루프
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className='relative overflow-x-auto pb-4'
        style={{
          minHeight: Math.ceil(pages.length / 4) * 180 + 40,
          paddingLeft: 80, // 왼쪽 루프 화살표 공간
        }}
      >
        {/* SVG for arrows */}
        <svg
          className='pointer-events-none absolute top-0'
          style={{
            left: 0,
            width: Math.min(pages.length, 4) * 200 + 80,
            height: Math.ceil(pages.length / 4) * 180 + 40,
          }}
        >
          <defs>
            <marker
              id='arrowhead-blue'
              markerWidth='10'
              markerHeight='7'
              refX='9'
              refY='3.5'
              orient='auto'
            >
              <polygon points='0 0, 10 3.5, 0 7' fill='#3b82f6' />
            </marker>
            <marker
              id='arrowhead-purple'
              markerWidth='10'
              markerHeight='7'
              refX='9'
              refY='3.5'
              orient='auto'
            >
              <polygon points='0 0, 10 3.5, 0 7' fill='#8b5cf6' />
            </marker>
            <marker
              id='arrowhead-green'
              markerWidth='10'
              markerHeight='7'
              refX='9'
              refY='3.5'
              orient='auto'
            >
              <polygon points='0 0, 10 3.5, 0 7' fill='#10b981' />
            </marker>
            <marker
              id='arrowhead-orange'
              markerWidth='10'
              markerHeight='7'
              refX='9'
              refY='3.5'
              orient='auto'
            >
              <polygon points='0 0, 10 3.5, 0 7' fill='#f59e0b' />
            </marker>
          </defs>

          {connections.map((conn, index) => {
            const { path, color, strokeWidth, dashArray } = getArrowPath(
              conn.fromPageIndex,
              conn.toPageIndex,
              conn.type
            )
            const markerId =
              conn.type === 'button'
                ? 'arrowhead-blue'
                : conn.type === 'touch'
                  ? 'arrowhead-purple'
                  : conn.type === 'auto'
                    ? 'arrowhead-green'
                    : 'arrowhead-orange'

            return (
              <path
                key={index}
                d={path}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                fill='none'
                markerEnd={`url(#${markerId})`}
                opacity={
                  hoveredPage === null ||
                  hoveredPage === conn.fromPageIndex ||
                  hoveredPage === conn.toPageIndex
                    ? 1
                    : 0.2
                }
                className='transition-opacity'
              />
            )
          })}
        </svg>

        {/* Page thumbnails */}
        <div
          className='relative grid gap-x-10 gap-y-20'
          style={{
            gridTemplateColumns: `repeat(${Math.min(pages.length, 4)}, 160px)`,
          }}
        >
          {pages.map((page, index) => {
            const thumb = thumbnails.find((t) => t.pageId === page.id)
            const validation = validatePage(page)
            const hasButtons = page.buttons.length > 0
            const hasTouchAreas = page.touchAreas.length > 0

            return (
              <div
                key={page.id}
                className={`group relative cursor-pointer transition-all ${
                  hoveredPage === index ? 'z-10 scale-105' : ''
                }`}
                onMouseEnter={() => setHoveredPage(index)}
                onMouseLeave={() => setHoveredPage(null)}
                onClick={() => onSelectPage(page.id)}
              >
                {/* 썸네일 카드 */}
                <div
                  className={`relative h-[90px] w-[160px] overflow-hidden rounded-lg border-2 bg-gray-800 shadow-md transition-all group-hover:shadow-xl ${
                    validation.isValid
                      ? 'border-gray-300 group-hover:border-blue-500'
                      : 'border-red-400'
                  }`}
                >
                  {/* 썸네일 이미지 */}
                  {thumb?.thumbnailUrl ? (
                    <img
                      src={thumb.thumbnailUrl}
                      alt={`Page ${index + 1}`}
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    <div className='flex h-full w-full items-center justify-center text-gray-500'>
                      {page.mediaId ? '로딩...' : '미디어 없음'}
                    </div>
                  )}

                  {/* 페이지 번호 뱃지 */}
                  <div className='absolute left-1 top-1 rounded bg-black bg-opacity-70 px-2 py-0.5 text-xs font-bold text-white'>
                    {index + 1}
                  </div>

                  {/* 재생 타입 아이콘 */}
                  <div
                    className='absolute bottom-1 right-1 rounded bg-black bg-opacity-70 px-1.5 py-0.5 text-xs'
                    title={page.playType === 'loop' ? '반복 재생' : '1회 재생'}
                  >
                    {page.playType === 'loop' ? '🔁' : '1️⃣'}
                  </div>

                  {/* 인터랙션 아이콘들 */}
                  <div className='absolute right-1 top-1 flex gap-1'>
                    {hasButtons && (
                      <span
                        className='rounded bg-blue-500 bg-opacity-80 px-1 text-xs text-white'
                        title={`버튼 ${page.buttons.length}개`}
                      >
                        🔘{page.buttons.length}
                      </span>
                    )}
                    {hasTouchAreas && (
                      <span
                        className='rounded bg-purple-500 bg-opacity-80 px-1 text-xs text-white'
                        title={`터치영역 ${page.touchAreas.length}개`}
                      >
                        👆{page.touchAreas.length}
                      </span>
                    )}
                  </div>

                  {/* 유효성 경고 */}
                  {!validation.isValid && (
                    <div className='absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-30'>
                      <span className='text-2xl'>⚠️</span>
                    </div>
                  )}

                  {/* 호버 오버레이 */}
                  <div className='absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 transition-all group-hover:bg-opacity-40'>
                    <span className='text-sm font-medium text-white opacity-0 group-hover:opacity-100'>
                      편집하기
                    </span>
                  </div>
                </div>

                {/* 미디어 타입 표시 */}
                <div className='mt-1 text-center text-xs text-gray-500'>
                  {page.mediaType === 'video' ? '🎥' : '🖼️'}{' '}
                  {page.mediaType === 'video' ? '영상' : '이미지'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 통계 요약 */}
      <div className='mt-4 flex justify-between border-t pt-4 text-sm text-gray-600'>
        <div>
          총 <strong>{pages.length}</strong>개 페이지
        </div>
        <div className='flex gap-4'>
          <span>
            버튼:{' '}
            <strong>{pages.reduce((sum, p) => sum + p.buttons.length, 0)}</strong>개
          </span>
          <span>
            터치영역:{' '}
            <strong>
              {pages.reduce((sum, p) => sum + p.touchAreas.length, 0)}
            </strong>
            개
          </span>
          <span>
            유효하지 않은 페이지:{' '}
            <strong className='text-red-600'>
              {pages.filter((p) => !validatePage(p).isValid).length}
            </strong>
            개
          </span>
        </div>
      </div>
    </div>
  )
}

export default FlowMap
