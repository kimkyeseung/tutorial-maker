import React, { useState, useEffect } from 'react'
import type { Page } from '../../types/project'
import { getMediaFile, createBlobURL } from '../../utils/mediaStorage'
import { validatePage } from '../../utils/pageValidation'
import ConfirmDialog from '../common/ConfirmDialog'

type PageListProps = {
  pages: Page[]
  selectedPageId: string | null
  onSelectPage: (pageId: string) => void
  onAddPage: () => void
  onDeletePage: (pageId: string) => void
  onReorderPages: (startIndex: number, endIndex: number) => void
}

type ThumbnailData = {
  url: string
  mediaType: 'video' | 'image'
  fileName: string
  mediaId: string
}

const PageList: React.FC<PageListProps> = ({
  pages,
  selectedPageId,
  onSelectPage,
  onAddPage,
  onDeletePage,
}) => {
  const [thumbnails, setThumbnails] = useState<Record<string, ThumbnailData>>(
    {}
  )
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    pageId: string
    pageIndex: number
  }>({ isOpen: false, pageId: '', pageIndex: 0 })

  const getValidationStatus = (page: Page) => {
    const result = validatePage(page)
    return result
  }

  // 비디오 썸네일 캡처
  const captureVideoThumbnail = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.src = URL.createObjectURL(blob)
      video.muted = true
      video.currentTime = 0.5

      video.onloadeddata = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 80
        canvas.height = 45
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.6))
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

  // 썸네일 로드
  useEffect(() => {
    const loadThumbnails = async () => {
      const newThumbnails: Record<string, ThumbnailData> = {}

      for (const page of pages) {
        // mediaId가 변경되었거나 썸네일이 없는 경우 다시 로드
        const existingThumbnail = thumbnails[page.id]
        const needsReload = page.mediaId && (!existingThumbnail || existingThumbnail.mediaId !== page.mediaId)

        if (needsReload) {
          const media = await getMediaFile(page.mediaId)
          if (media) {
            let url: string
            if (page.mediaType === 'image') {
              url = createBlobURL(media.blob)
            } else {
              url = await captureVideoThumbnail(media.blob)
            }
            newThumbnails[page.id] = { url, mediaType: page.mediaType, fileName: media.name, mediaId: page.mediaId }
          }
        }
      }

      if (Object.keys(newThumbnails).length > 0) {
        setThumbnails((prev) => ({ ...prev, ...newThumbnails }))
      }
    }

    loadThumbnails()
  }, [pages])

  return (
    <div className='rounded-lg bg-white p-4 shadow'>
      {/* 페이지 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title='페이지 삭제'
        message={`페이지 ${deleteConfirm.pageIndex + 1}을(를) 삭제하시겠습니까?`}
        confirmText='삭제'
        cancelText='취소'
        onConfirm={() => {
          onDeletePage(deleteConfirm.pageId)
          setDeleteConfirm({ isOpen: false, pageId: '', pageIndex: 0 })
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, pageId: '', pageIndex: 0 })}
        variant='danger'
      />

      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>페이지 목록</h3>
        <button
          onClick={onAddPage}
          className='rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700'
        >
          + 페이지 추가
        </button>
      </div>

      {pages.length === 0 ? (
        <div className='py-8 text-center text-gray-500'>
          <p className='mb-2'>페이지가 없습니다</p>
          <p className='text-sm'>위의 버튼을 눌러 첫 페이지를 추가하세요</p>
        </div>
      ) : (
        <div className='space-y-2'>
          {pages.map((page, index) => {
            const validation = getValidationStatus(page)
            return (
              <div
                key={page.id}
                onClick={() => onSelectPage(page.id)}
                className={`cursor-pointer rounded border p-3 transition-colors ${
                  selectedPageId === page.id
                    ? validation.isValid
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-red-500 bg-red-50'
                    : validation.isValid
                      ? 'border-gray-300 hover:bg-gray-50'
                      : 'border-red-300 bg-red-50 hover:bg-red-100'
                }`}
              >
                <div className='flex items-center gap-3'>
                  {/* 썸네일 */}
                  <div className='relative h-[45px] w-[80px] flex-shrink-0 overflow-hidden rounded bg-gray-800'>
                    {thumbnails[page.id] ? (
                      <img
                        src={thumbnails[page.id].url}
                        alt={`Page ${index + 1}`}
                        className='h-full w-full object-cover'
                      />
                    ) : page.mediaId ? (
                      <div className='flex h-full w-full items-center justify-center text-xs text-gray-500'>
                        로딩...
                      </div>
                    ) : (
                      <div className='flex h-full w-full items-center justify-center text-xs text-gray-500'>
                        없음
                      </div>
                    )}
                    {/* 페이지 번호 뱃지 */}
                    <div className='absolute left-0.5 top-0.5 rounded bg-black bg-opacity-70 px-1 text-[10px] font-bold text-white'>
                      {index + 1}
                    </div>
                  </div>

                  {/* 정보 */}
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-2 text-sm font-medium'>
                      {/* 재생 타입 뱃지 */}
                      <div
                        className={`rounded inline-block px-1 text-[9px] font-bold ${
                          page.playType === 'loop'
                            ? 'bg-orange-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        {page.playType === 'loop' ? '반복' : `${page.playCount || 1}회`}
                      </div>
                      <span>페이지 {index + 1}</span>
                      {validation.isValid ? (
                        <span className='text-green-600' title='유효함'>
                          ✓
                        </span>
                      ) : (
                        <span
                          className='text-red-600'
                          title={validation.errors.join('\n')}
                        >
                          ⚠
                        </span>
                      )}
                    </div>
                    <div className='mt-0.5 text-xs text-gray-500'>
                      {page.mediaType === 'video' ? '🎥' : '🖼️'}{' '}
                      {thumbnails[page.id]?.fileName ? (
                        <span className='truncate' title={thumbnails[page.id].fileName}>
                          {thumbnails[page.id].fileName.length > 20
                            ? thumbnails[page.id].fileName.substring(0, 20) + '...'
                            : thumbnails[page.id].fileName}
                        </span>
                      ) : (
                        <>버튼 {page.buttons.length} • 터치 영역 {page.touchAreas.length}</>
                      )}
                    </div>
                    {!validation.isValid && (
                      <div className='mt-0.5 truncate text-xs text-red-600'>
                        {validation.errors[0]}
                      </div>
                    )}
                  </div>

                  {/* 삭제 버튼 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirm({ isOpen: true, pageId: page.id, pageIndex: index })
                    }}
                    className='flex-shrink-0 rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50'
                  >
                    삭제
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PageList
