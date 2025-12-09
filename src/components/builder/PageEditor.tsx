import React, { useState, useEffect } from 'react'
import type { Page, PageButton, TouchArea } from '../../types/project'
import {
  getMediaFile,
  createBlobURL,
  revokeBlobURL,
} from '../../utils/mediaStorage'
import ButtonEditor from './ButtonEditor'
import MediaUploader from './MediaUploader'
import TouchAreaEditor from './TouchAreaEditor'

type PageEditorProps = {
  page: Page | null
  onUpdate: (updates: Partial<Page>) => void
  totalPages: number
}

const PageEditor: React.FC<PageEditorProps> = ({
  page,
  onUpdate,
  totalPages,
}) => {
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaFileName, setMediaFileName] = useState<string | null>(null)
  const [showMediaUploader, setShowMediaUploader] = useState(false)

  useEffect(() => {
    if (page?.mediaId) {
      loadMediaPreview(page.mediaId)
    } else {
      setMediaFileName(null)
    }

    return () => {
      if (mediaPreview) {
        revokeBlobURL(mediaPreview)
      }
    }
  }, [page?.mediaId])

  const loadMediaPreview = async (mediaId: string) => {
    const media = await getMediaFile(mediaId)
    if (media) {
      const url = createBlobURL(media.blob)
      setMediaPreview(url)
      setMediaFileName(media.name)
    }
  }

  const handleMediaUploaded = async (
    mediaId: string,
    mediaType: 'video' | 'image'
  ) => {
    onUpdate({ mediaId, mediaType })
    setShowMediaUploader(false)
    await loadMediaPreview(mediaId)
  }

  if (!page) {
    return (
      <div className='rounded-lg bg-white p-8 text-center shadow'>
        <p className='text-gray-500'>
          왼쪽에서 페이지를 선택하거나 새 페이지를 추가하세요
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* 페이지 기본 설정 */}
      <div className='rounded-lg bg-white p-6 shadow'>
        <h3 className='mb-4 text-lg font-semibold'>페이지 설정</h3>

        <div className='space-y-4'>
          {/* 재생 타입 */}
          <div>
            <label className='mb-2 block text-sm font-medium text-gray-700'>
              재생 타입
            </label>
            <div className='flex gap-4'>
              <label className='flex cursor-pointer items-center'>
                <input
                  type='radio'
                  checked={page.playType === 'loop'}
                  onChange={() => onUpdate({ playType: 'loop' })}
                  className='mr-2'
                />
                <span className='text-sm'>
                  반복 재생 (다음 버튼 누를 때까지)
                </span>
              </label>
              <label className='flex cursor-pointer items-center'>
                <input
                  type='radio'
                  checked={page.playType === 'single'}
                  onChange={() => onUpdate({ playType: 'single' })}
                  className='mr-2'
                />
                <span className='text-sm'>단일 재생 (끝나면 자동 이동)</span>
              </label>
            </div>
          </div>

          {/* 미디어 미리보기 */}
          {page.mediaId ? (
            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                미디어 미리보기
              </label>
              <div className='overflow-hidden rounded-lg border bg-black'>
                {page.mediaType === 'video' && mediaPreview ? (
                  <video
                    src={mediaPreview}
                    controls
                    className='max-h-96 w-full object-contain'
                  />
                ) : page.mediaType === 'image' && mediaPreview ? (
                  <img
                    src={mediaPreview}
                    alt='Preview'
                    className='max-h-96 w-full object-contain'
                  />
                ) : (
                  <div className='flex h-48 items-center justify-center text-gray-400'>
                    로딩 중...
                  </div>
                )}
              </div>
              <div className='mt-2 flex items-center justify-between'>
                {mediaFileName && (
                  <span className='truncate text-sm text-gray-600' title={mediaFileName}>
                    {page.mediaType === 'video' ? '🎥' : '🖼️'} {mediaFileName}
                  </span>
                )}
                <button
                  onClick={() => setShowMediaUploader(true)}
                  className='rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200'
                >
                  미디어 변경
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                미디어
              </label>
              <button
                onClick={() => setShowMediaUploader(true)}
                className='w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-gray-600 transition-colors hover:border-blue-500 hover:bg-blue-50'
              >
                + 영상 또는 이미지 추가
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 버튼 편집기 */}
      {page.mediaId && (
        <ButtonEditor
          buttons={page.buttons}
          onUpdate={(buttons: PageButton[]) => onUpdate({ buttons })}
          mediaUrl={mediaPreview}
          mediaType={page.mediaType}
          totalPages={totalPages}
        />
      )}

      {/* 터치 영역 편집기 */}
      {page.mediaId && (
        <TouchAreaEditor
          touchAreas={page.touchAreas}
          onUpdate={(touchAreas: TouchArea[]) => onUpdate({ touchAreas })}
          mediaUrl={mediaPreview}
          mediaType={page.mediaType}
          totalPages={totalPages}
        />
      )}

      {!page.mediaId && (
        <div className='rounded-lg bg-white p-6 shadow'>
          <p className='text-center text-gray-500'>
            버튼과 터치 영역을 추가하려면 먼저 미디어를 업로드하세요
          </p>
        </div>
      )}

      {/* 미디어 업로더 모달 */}
      {showMediaUploader && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='mx-4 w-full max-w-lg rounded-lg bg-white p-6'>
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='text-lg font-semibold'>미디어 업로드</h3>
              <button
                onClick={() => setShowMediaUploader(false)}
                className='text-gray-500 hover:text-gray-700'
              >
                ✕
              </button>
            </div>
            <MediaUploader onMediaUploaded={handleMediaUploaded} />
          </div>
        </div>
      )}
    </div>
  )
}

export default PageEditor
