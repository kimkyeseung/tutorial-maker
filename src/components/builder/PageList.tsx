import React from 'react'
import type { Page } from '../../types/project'
import { validatePage } from '../../utils/pageValidation'

type PageListProps = {
  pages: Page[]
  selectedPageId: string | null
  onSelectPage: (pageId: string) => void
  onAddPage: () => void
  onDeletePage: (pageId: string) => void
  onReorderPages: (startIndex: number, endIndex: number) => void
}

const PageList: React.FC<PageListProps> = ({
  pages,
  selectedPageId,
  onSelectPage,
  onAddPage,
  onDeletePage,
}) => {
  const getValidationStatus = (page: Page) => {
    const result = validatePage(page)
    return result
  }

  return (
    <div className='rounded-lg bg-white p-4 shadow'>
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
                <div className='flex items-center justify-between'>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 text-sm font-medium'>
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
                    <div className='mt-1 text-xs text-gray-500'>
                      {page.mediaType === 'video' ? '🎥 영상' : '🖼️ 이미지'} •
                      {page.playType === 'loop' ? ' 반복' : ' 단일'} • 버튼{' '}
                      {page.buttons.length}개 • 영역 {page.touchAreas.length}개
                    </div>
                    {!validation.isValid && (
                      <div className='mt-1 text-xs text-red-600'>
                        {validation.errors.map((error, i) => (
                          <div key={i}>• {error}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('이 페이지를 삭제하시겠습니까?')) {
                        onDeletePage(page.id)
                      }
                    }}
                    className='ml-2 rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50'
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
