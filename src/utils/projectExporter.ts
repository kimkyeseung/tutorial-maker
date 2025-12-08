import JSZip from 'jszip'
import type { Project } from '../types/project'
import {
  getMediaFile,
  getButtonImage,
  getAppIcon,
  saveProject,
  saveMediaFile,
  saveButtonImage,
  saveAppIcon,
} from './mediaStorage'

export const exportProjectAsZip = async (project: Project): Promise<Blob> => {
  const zip = new JSZip()

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

export const downloadZip = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const exportProject = async (project: Project) => {
  try {
    const zipBlob = await exportProjectAsZip(project)
    const filename = `${project.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.zip`
    downloadZip(zipBlob, filename)
    return true
  } catch (error) {
    console.error('Failed to export project:', error)
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
