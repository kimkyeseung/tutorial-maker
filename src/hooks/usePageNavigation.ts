import { useState, useEffect, useMemo } from 'react'
import type { Project } from '../types/project'

export function usePageNavigation(project: Project | null) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [mountedPages, setMountedPages] = useState<Set<number>>(new Set([0]))

  const goToNextPage = () => {
    if (!project) return

    if (currentPageIndex < project.pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1)
    } else if (project.settings.loopAtEnd) {
      setCurrentPageIndex(0)
    }
  }

  const goToPreviousPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1)
    }
  }

  const goToHome = () => {
    setCurrentPageIndex(0)
  }

  const goToPage = (pageIndex: number) => {
    if (!project) return
    if (pageIndex >= 0 && pageIndex < project.pages.length) {
      setCurrentPageIndex(pageIndex)
    }
  }

  // 현재 페이지에서 연결된 페이지들 계산 (프리로딩 대상)
  const connectedPages = useMemo(() => {
    if (!project) return new Set<number>()

    const connected = new Set<number>([currentPageIndex])
    const currentPage = project.pages[currentPageIndex]

    if (!currentPage) return connected

    // 다음 페이지 (버튼/터치에서 'next' 액션이 있거나, single 재생 타입일 때)
    const nextIndex = currentPageIndex + 1
    if (nextIndex < project.pages.length) {
      connected.add(nextIndex)
    } else if (project.settings.loopAtEnd) {
      connected.add(0) // 마지막에서 처음으로
    }

    // 버튼에서 goto로 연결된 페이지들
    currentPage.buttons.forEach((button) => {
      if (
        button.action.type === 'goto' &&
        button.action.targetPageId !== undefined
      ) {
        const targetIndex = parseInt(button.action.targetPageId)
        if (targetIndex >= 0 && targetIndex < project.pages.length) {
          connected.add(targetIndex)
        }
      }
    })

    // 터치 영역에서 goto로 연결된 페이지들
    currentPage.touchAreas.forEach((touchArea) => {
      if (
        touchArea.action.type === 'goto' &&
        touchArea.action.targetPageId !== undefined
      ) {
        const targetIndex = parseInt(touchArea.action.targetPageId)
        if (targetIndex >= 0 && targetIndex < project.pages.length) {
          connected.add(targetIndex)
        }
      }
    })

    return connected
  }, [project, currentPageIndex])

  // 연결된 페이지들을 마운트된 페이지 목록에 추가
  useEffect(() => {
    setMountedPages((prev) => {
      const newSet = new Set(prev)
      connectedPages.forEach((pageIndex) => newSet.add(pageIndex))
      return newSet
    })
  }, [connectedPages])

  const currentPage = project?.pages[currentPageIndex] || null

  return {
    currentPageIndex,
    currentPage,
    mountedPages,
    goToNextPage,
    goToPreviousPage,
    goToHome,
    goToPage,
  }
}
