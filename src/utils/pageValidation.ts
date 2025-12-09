import type { Page } from '../types/project'

export interface PageValidationResult {
  isValid: boolean
  errors: string[]
}

export function validatePage(page: Page): PageValidationResult {
  const errors: string[] = []

  // 1. 미디어 필수 체크
  if (!page.mediaId) {
    errors.push('미디어 파일이 없습니다')
  }

  // 2. 반복 재생일 경우 버튼 또는 터치 영역 필수
  if (page.playType === 'loop') {
    const hasButtons = page.buttons.length > 0
    const hasTouchAreas = page.touchAreas.length > 0

    if (!hasButtons && !hasTouchAreas) {
      errors.push('반복 재생 시 버튼 또는 터치 영역이 필요합니다')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function validateAllPages(pages: Page[]): {
  isValid: boolean
  invalidPages: { pageIndex: number; errors: string[] }[]
} {
  const invalidPages: { pageIndex: number; errors: string[] }[] = []

  pages.forEach((page, index) => {
    const result = validatePage(page)
    if (!result.isValid) {
      invalidPages.push({
        pageIndex: index,
        errors: result.errors,
      })
    }
  })

  return {
    isValid: invalidPages.length === 0,
    invalidPages,
  }
}
