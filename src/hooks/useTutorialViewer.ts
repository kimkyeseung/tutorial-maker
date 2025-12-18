import { useState, useEffect, useCallback } from 'react'
import type { Project } from '../types/project'
import {
  loadTutorialFile,
  loadTutorialFromFile,
  createMediaUrls,
  revokeMediaUrls,
} from '../utils/tutorialLoader'

interface UseTutorialViewerResult {
  project: Project | null
  mediaUrls: Record<string, string>
  buttonImageUrls: Record<string, string>
  iconUrl?: string
  isLoading: boolean
  error: string | null
  loadFromPath: (filePath: string) => Promise<void>
  loadFromFile: (file: File) => Promise<void>
  reset: () => void
}

export function useTutorialViewer(
  initialFilePath?: string | null
): UseTutorialViewerResult {
  const [project, setProject] = useState<Project | null>(null)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [buttonImageUrls, setButtonImageUrls] = useState<Record<string, string>>({})
  const [iconUrl, setIconUrl] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // URL 정리 함수
  const cleanup = useCallback(() => {
    revokeMediaUrls(mediaUrls)
    revokeMediaUrls(buttonImageUrls)
    if (iconUrl) {
      URL.revokeObjectURL(iconUrl)
    }
  }, [mediaUrls, buttonImageUrls, iconUrl])

  // 파일 경로로 로드 (Tauri 환경)
  const loadFromPath = useCallback(async (filePath: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const tutorial = await loadTutorialFile(filePath)
      const urls = createMediaUrls(tutorial)

      setProject(tutorial.project)
      setMediaUrls(urls.mediaUrls)
      setButtonImageUrls(urls.buttonImageUrls)
      setIconUrl(urls.iconUrl)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load tutorial'
      setError(errorMessage)
      console.error('Failed to load tutorial from path:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // File 객체로 로드 (웹 환경)
  const loadFromFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)

    try {
      const tutorial = await loadTutorialFromFile(file)
      const urls = createMediaUrls(tutorial)

      setProject(tutorial.project)
      setMediaUrls(urls.mediaUrls)
      setButtonImageUrls(urls.buttonImageUrls)
      setIconUrl(urls.iconUrl)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load tutorial'
      setError(errorMessage)
      console.error('Failed to load tutorial from file:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 상태 초기화
  const reset = useCallback(() => {
    cleanup()
    setProject(null)
    setMediaUrls({})
    setButtonImageUrls({})
    setIconUrl(undefined)
    setError(null)
  }, [cleanup])

  // 초기 파일 경로가 있으면 자동 로드
  useEffect(() => {
    if (initialFilePath) {
      loadFromPath(initialFilePath)
    }
  }, [initialFilePath, loadFromPath])

  // 컴포넌트 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    project,
    mediaUrls,
    buttonImageUrls,
    iconUrl,
    isLoading,
    error,
    loadFromPath,
    loadFromFile,
    reset,
  }
}
