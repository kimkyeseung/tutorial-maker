import JSZip from 'jszip'
import type { Project, TutorialManifest } from '../types/project'
import {
  getMediaFile,
  getButtonImage,
  getAppIcon,
  saveProject,
  saveMediaFile,
  saveButtonImage,
  saveAppIcon,
} from './mediaStorage'

// manifest.json 생성
const createManifest = (project: Project): TutorialManifest => ({
  version: '1.0.0',
  formatVersion: 1,
  createdAt: Date.now(),
  createdWith: 'Tutorial Maker v0.1.0',
  projectName: project.name,
})

export const exportProjectAsZip = async (project: Project): Promise<Blob> => {
  const zip = new JSZip()

  // manifest.json 추가
  const manifest = createManifest(project)
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  // 프로젝트 데이터 (JSON)
  const projectData = {
    ...project,
    // IndexedDB IDs는 그대로 유지
  }

  zip.file('project.json', JSON.stringify(projectData, null, 2))

  // 미디어 폴더 생성
  const mediaFolder = zip.folder('media')
  if (!mediaFolder) throw new Error('Failed to create media folder')

  // 버튼 이미지 폴더 생성
  const buttonFolder = zip.folder('buttons')
  if (!buttonFolder) throw new Error('Failed to create buttons folder')

  // 앱 아이콘 폴더 생성
  const iconFolder = zip.folder('icons')
  if (!iconFolder) throw new Error('Failed to create icons folder')

  // 모든 페이지의 미디어 파일 수집
  for (const page of project.pages) {
    if (page.mediaId) {
      const media = await getMediaFile(page.mediaId)
      if (media) {
        const extension = media.name.split('.').pop() || 'mp4'
        mediaFolder.file(`${page.mediaId}.${extension}`, media.blob)
      }
    }

    // 버튼 이미지 수집
    for (const button of page.buttons) {
      if (button.imageId) {
        const image = await getButtonImage(button.imageId)
        if (image) {
          const extension = image.name.split('.').pop() || 'png'
          buttonFolder.file(`${button.imageId}.${extension}`, image.blob)
        }
      }
    }
  }

  // 앱 아이콘 수집
  if (project.appIcon) {
    const icon = await getAppIcon(project.appIcon)
    if (icon) {
      const extension = icon.name.split('.').pop() || 'png'
      iconFolder.file(`${project.appIcon}.${extension}`, icon.blob)
    }
  }

  // ZIP 파일 생성
  return await zip.generateAsync({ type: 'blob' })
}

export const downloadFile = async (blob: Blob, filename: string): Promise<boolean> => {
  // Tauri 환경인지 확인
  if ('__TAURI_INTERNALS__' in window) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')

      // 저장 다이얼로그 열기
      const filePath = await save({
        defaultPath: filename,
        filters: [{ name: 'Tutorial', extensions: ['tutorial'] }],
      })

      if (filePath) {
        // Blob을 ArrayBuffer로 변환
        const arrayBuffer = await blob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        // 파일 저장
        await writeFile(filePath, uint8Array)
        return true
      }
      return false
    } catch (error) {
      console.error('Tauri file save failed:', error)
      return false
    }
  } else {
    // 웹 환경에서는 기존 방식 사용
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  }
}

// 하위 호환성을 위해 유지
export const downloadZip = downloadFile

export const exportProject = async (project: Project) => {
  try {
    const zipBlob = await exportProjectAsZip(project)
    const filename = `${project.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.zip`
    return await downloadFile(zipBlob, filename)
  } catch (error) {
    console.error('Failed to export project:', error)
    return false
  }
}

// .tutorial 파일로 내보내기
export const exportAsTutorial = async (project: Project): Promise<boolean> => {
  try {
    const blob = await exportProjectAsZip(project)
    // 파일명에서 특수문자 제거하고 한글은 유지
    const safeName = project.name.replace(/[<>:"/\\|?*]/g, '_')
    const filename = `${safeName}프로젝트.tutorial`
    return await downloadFile(blob, filename)
  } catch (error) {
    console.error('Failed to export as tutorial:', error)
    return false
  }
}

export const importProjectFromZip = async (
  file: File
): Promise<Project | null> => {
  try {
    const zip = await JSZip.loadAsync(file)

    // project.json 읽기
    const projectFile = zip.file('project.json')
    if (!projectFile) {
      throw new Error('project.json not found in ZIP')
    }

    const projectJson = await projectFile.async('text')
    const project: Project = JSON.parse(projectJson)

    // 새 ID 생성 (중복 방지)
    project.id = crypto.randomUUID()
    project.createdAt = Date.now()
    project.updatedAt = Date.now()

    // 미디어 파일 임포트
    const mediaFolder = zip.folder('media')
    if (mediaFolder) {
      for (const page of project.pages) {
        if (page.mediaId) {
          const files = Object.keys(mediaFolder.files).filter((f) =>
            f.startsWith(`media/${page.mediaId}`)
          )
          if (files.length > 0) {
            const mediaFile = mediaFolder.files[files[0]]
            const blob = await mediaFile.async('blob')
            const fileName = files[0].split('/').pop() || 'media'
            const file = new File([blob], fileName)

            // 원래 ID로 저장 (참조 유지)
            await saveMediaFile(file, page.mediaType)
          }
        }
      }
    }

    // 버튼 이미지 임포트
    const buttonFolder = zip.folder('buttons')
    if (buttonFolder) {
      for (const page of project.pages) {
        for (const button of page.buttons) {
          if (button.imageId) {
            const files = Object.keys(buttonFolder.files).filter((f) =>
              f.startsWith(`buttons/${button.imageId}`)
            )
            if (files.length > 0) {
              const buttonFile = buttonFolder.files[files[0]]
              const blob = await buttonFile.async('blob')
              const fileName = files[0].split('/').pop() || 'button.png'
              const file = new File([blob], fileName)

              // 원래 ID로 저장
              await saveButtonImage(file)
            }
          }
        }
      }
    }

    // 앱 아이콘 임포트
    if (project.appIcon) {
      const iconFolder = zip.folder('icons')
      if (iconFolder) {
        const files = Object.keys(iconFolder.files).filter((f) =>
          f.startsWith(`icons/${project.appIcon}`)
        )
        if (files.length > 0) {
          const iconFile = iconFolder.files[files[0]]
          const blob = await iconFile.async('blob')
          const fileName = files[0].split('/').pop() || 'icon.png'
          const file = new File([blob], fileName)

          await saveAppIcon(file)
        }
      }
    }

    // 프로젝트 저장
    await saveProject(project)

    return project
  } catch (error) {
    console.error('Failed to import project:', error)
    return null
  }
}
