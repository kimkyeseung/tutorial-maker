import { useState, useEffect } from 'react'
import type { Project, MediaManifestEntry } from '../types/project'
import {
  getProject,
  getMediaFile,
  getButtonImage,
  createBlobURL,
} from '../utils/mediaStorage'

// Base64를 Blob URL로 변환 (V1 호환용)
function base64ToBlobUrl(base64: string, mimeType: string): string {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: mimeType })
  return URL.createObjectURL(blob)
}

// Uint8Array를 Blob URL로 변환 (V2용)
function bytesToBlobUrl(bytes: Uint8Array, mimeType: string): string {
  // 새 ArrayBuffer로 복사
  const newBuffer = new ArrayBuffer(bytes.length)
  const newView = new Uint8Array(newBuffer)
  newView.set(bytes)
  const blob = new Blob([newBuffer], { type: mimeType })
  return URL.createObjectURL(blob)
}

export function useProductProject(projectId?: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [buttonImageUrls, setButtonImageUrls] = useState<Record<string, string>>(
    {}
  )
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadProjectData()
  }, [projectId])

  const loadProjectData = async () => {
    try {
      const isProductMode = import.meta.env.VITE_APP_MODE === 'product'

      if (isProductMode) {
        // 프로덕트 모드: exe에서 바이너리 미디어 로드
        await loadProductModeData()
        setIsLoading(false)
        return
      }

      // 개발 모드: IndexedDB에서 로드
      if (!projectId) {
        console.error('No project ID provided for preview')
        setIsLoading(false)
        return
      }

      const projectData = await getProject(projectId)
      if (!projectData) {
        console.error('Project not found:', projectId)
        setIsLoading(false)
        return
      }
      setProject(projectData)

      // 페이지 미디어 로드
      const urls: Record<string, string> = {}
      for (const page of projectData.pages) {
        if (page.mediaId) {
          const media = await getMediaFile(page.mediaId)
          if (media) {
            urls[page.mediaId] = createBlobURL(media.blob)
          }
        }
      }
      setMediaUrls(urls)

      // 버튼 이미지 로드
      const buttonUrls: Record<string, string> = {}
      for (const page of projectData.pages) {
        for (const button of page.buttons) {
          if (button.imageId && !buttonUrls[button.imageId]) {
            const image = await getButtonImage(button.imageId)
            if (image) {
              buttonUrls[button.imageId] = createBlobURL(image.blob)
            }
          }
        }
      }
      setButtonImageUrls(buttonUrls)

      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load project data:', error)
      setIsLoading(false)
    }
  }

  // 프로덕트 모드 데이터 로드
  const loadProductModeData = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')

      // V2 시도: read_project_file_v2 + read_embedded_media
      try {
        // 프로젝트 JSON 읽기 (V2 또는 V1 자동 선택)
        const projectJson = await invoke<string>('read_project_file_v2')
        const projectData: Project = JSON.parse(projectJson)
        setProject(projectData)

        // 미디어 매니페스트 가져오기 시도
        try {
          const manifestJson = await invoke<string>('get_media_manifest')
          const mediaManifest: MediaManifestEntry[] = JSON.parse(manifestJson)

          const urls: Record<string, string> = {}
          const btnUrls: Record<string, string> = {}

          // 각 미디어 로드
          for (const entry of mediaManifest) {
            const mediaBytes = await invoke<number[]>('read_embedded_media', {
              mediaId: entry.id,
            })
            const uint8Array = new Uint8Array(mediaBytes)
            const blobUrl = bytesToBlobUrl(uint8Array, entry.mimeType)

            // 미디어 타입에 따라 분류
            const isButtonImage = projectData.pages.some((page) =>
              page.buttons.some((btn) => btn.imageId === entry.id)
            )
            const isPageMedia = projectData.pages.some(
              (page) => page.mediaId === entry.id
            )

            if (isButtonImage) {
              btnUrls[entry.id] = blobUrl
            }
            if (isPageMedia) {
              urls[entry.id] = blobUrl
            }
            // 분류 안 되면 둘 다에 추가
            if (!isButtonImage && !isPageMedia) {
              urls[entry.id] = blobUrl
              btnUrls[entry.id] = blobUrl
            }
          }

          setMediaUrls(urls)
          setButtonImageUrls(btnUrls)
          return
        } catch {
          // V2 매니페스트 실패 -> V1 방식 (embeddedMedia) 시도
          console.log('V2 manifest not found, trying V1 format...')
        }

        // V1 방식: embeddedMedia 배열에서 Base64 디코딩
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const buildProject = JSON.parse(projectJson) as any
        if (buildProject.embeddedMedia && Array.isArray(buildProject.embeddedMedia)) {
          const urls: Record<string, string> = {}
          const btnUrls: Record<string, string> = {}

          for (const media of buildProject.embeddedMedia) {
            const blobUrl = base64ToBlobUrl(media.base64, media.mimeType)

            const isButtonImage = projectData.pages.some((page) =>
              page.buttons.some((btn) => btn.imageId === media.id)
            )
            const isPageMedia = projectData.pages.some(
              (page) => page.mediaId === media.id
            )

            if (isButtonImage) {
              btnUrls[media.id] = blobUrl
            }
            if (isPageMedia) {
              urls[media.id] = blobUrl
            }
            if (!isButtonImage && !isPageMedia) {
              urls[media.id] = blobUrl
              btnUrls[media.id] = blobUrl
            }
          }

          setMediaUrls(urls)
          setButtonImageUrls(btnUrls)
        }
      } catch (e) {
        console.error('Failed to load project data:', e)
      }
    } catch (e) {
      console.error('Failed to import Tauri API:', e)
    }
  }

  return { project, mediaUrls, buttonImageUrls, isLoading }
}
