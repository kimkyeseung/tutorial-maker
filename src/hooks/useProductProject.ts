import { useState, useEffect } from 'react'
import type { Project, BuildProject } from '../types/project'
import {
  getProject,
  getMediaFile,
  getButtonImage,
  createBlobURL,
} from '../utils/mediaStorage'

// Base64를 Blob URL로 변환
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
        // 프로덕트 모드: project.json에서 Base64 미디어 로드
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          const projectJson = await invoke<string>('read_project_file')
          const buildProject: BuildProject = JSON.parse(projectJson)

          // BuildProject를 Project로 변환
          const projectData: Project = {
            id: buildProject.id,
            name: buildProject.name,
            description: buildProject.description,
            appTitle: buildProject.appTitle,
            pages: buildProject.pages,
            settings: buildProject.settings,
            createdAt: buildProject.createdAt,
            updatedAt: buildProject.updatedAt,
          }

          setProject(projectData)

          // embeddedMedia에서 URL 생성
          const urls: Record<string, string> = {}
          const btnUrls: Record<string, string> = {}

          for (const media of buildProject.embeddedMedia) {
            const blobUrl = base64ToBlobUrl(media.base64, media.mimeType)

            // 미디어 타입에 따라 분류
            const isButtonImage = projectData.pages.some((page) =>
              page.buttons.some((btn) => btn.imageId === media.id)
            )

            if (isButtonImage) {
              btnUrls[media.id] = blobUrl
            }
            // 페이지 미디어인지 확인
            const isPageMedia = projectData.pages.some(
              (page) => page.mediaId === media.id
            )
            if (isPageMedia) {
              urls[media.id] = blobUrl
            }
            // 둘 다일 수 있으므로 별도 체크
            if (!isButtonImage && !isPageMedia) {
              // 알 수 없는 미디어는 둘 다에 추가
              urls[media.id] = blobUrl
              btnUrls[media.id] = blobUrl
            }
          }

          setMediaUrls(urls)
          setButtonImageUrls(btnUrls)
        } catch (e) {
          console.error('Failed to load project.json:', e)
        }

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

  return { project, mediaUrls, buttonImageUrls, isLoading }
}
