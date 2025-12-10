import { useState, useEffect } from 'react'
import type { Project } from '../types/project'
import { getAllProjects, getMediaFile, createBlobURL } from '../utils/mediaStorage'

export function useProductProject() {
  const [project, setProject] = useState<Project | null>(null)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadProjectData()
  }, [])

  const loadProjectData = async () => {
    try {
      const isProductMode = import.meta.env.VITE_APP_MODE === 'product'

      let projectData: Project

      if (isProductMode) {
        // 프로덕트 모드: Rust 백엔드에서 실행 파일과 같은 디렉토리의 project.json 로드
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          const projectJson = await invoke<string>('read_project_file')
          projectData = JSON.parse(projectJson)
        } catch (e) {
          console.error('Failed to load project.json:', e)
          setIsLoading(false)
          return
        }
      } else {
        // 개발 모드: IndexedDB에서 로드
        const projects = await getAllProjects()
        if (projects.length === 0) {
          console.error('No projects found')
          setIsLoading(false)
          return
        }
        projectData = projects[0]
      }

      setProject(projectData)

      // 모든 미디어 파일 로드
      const urls: Record<string, string> = {}
      for (const page of projectData.pages) {
        if (page.mediaId) {
          if (isProductMode) {
            // 프로덕트 모드: Rust 백엔드에서 직접 미디어 파일 읽기
            try {
              const { invoke } = await import('@tauri-apps/api/core')
              const mediaData = await invoke<number[]>('read_media_file', {
                mediaId: page.mediaId,
              })
              // 바이너리 데이터를 Blob으로 변환 (MIME 타입 지정)
              const uint8Array = new Uint8Array(mediaData)
              // 미디어 타입에 따라 MIME 타입 결정
              const mimeType =
                page.mediaType === 'video' ? 'video/mp4' : 'image/png'
              const blob = new Blob([uint8Array], { type: mimeType })
              urls[page.mediaId] = URL.createObjectURL(blob)
            } catch (e) {
              console.error('Failed to load media:', page.mediaId, e)
            }
          } else {
            // 개발 모드: IndexedDB에서 로드
            const media = await getMediaFile(page.mediaId)
            if (media) {
              urls[page.mediaId] = createBlobURL(media.blob)
            }
          }
        }
      }

      setMediaUrls(urls)
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load project data:', error)
      setIsLoading(false)
    }
  }

  return { project, mediaUrls, isLoading }
}
