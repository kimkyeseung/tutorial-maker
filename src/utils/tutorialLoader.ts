import JSZip from 'jszip'
import type { Project, TutorialManifest, LoadedTutorial } from '../types/project'

// .tutorial 또는 .zip 파일을 로드하여 튜토리얼 데이터 반환
export const loadTutorialFile = async (
  filePath: string
): Promise<LoadedTutorial> => {
  // Tauri fs 플러그인으로 파일 읽기
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const fileData = await readFile(filePath)

  // ZIP 압축 해제
  const zip = await JSZip.loadAsync(fileData)

  // manifest.json 읽기 (없으면 기본값 사용 - 하위 호환성)
  const manifestFile = zip.file('manifest.json')
  const manifest: TutorialManifest = manifestFile
    ? JSON.parse(await manifestFile.async('text'))
    : {
        version: '1.0.0',
        formatVersion: 1,
        createdAt: 0,
        createdWith: 'Unknown',
        projectName: 'Unknown',
      }

  // project.json 읽기
  const projectFile = zip.file('project.json')
  if (!projectFile) {
    throw new Error('project.json not found in tutorial file')
  }
  const project: Project = JSON.parse(await projectFile.async('text'))

  // 미디어 파일들을 Blob으로 로드
  const mediaBlobs: Record<string, Blob> = {}
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.startsWith('media/') && !file.dir) {
      const blob = await file.async('blob')
      // 파일명에서 확장자 제거하여 mediaId 추출
      const fileName = path.replace('media/', '')
      const mediaId = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
      mediaBlobs[mediaId] = blob
    }
  }

  // 버튼 이미지 로드
  const buttonBlobs: Record<string, Blob> = {}
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.startsWith('buttons/') && !file.dir) {
      const blob = await file.async('blob')
      const fileName = path.replace('buttons/', '')
      const buttonId = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
      buttonBlobs[buttonId] = blob
    }
  }

  // 앱 아이콘 로드
  let iconBlob: Blob | undefined
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.startsWith('icons/') && !file.dir) {
      iconBlob = await file.async('blob')
      break // 첫 번째 아이콘만 사용
    }
  }

  return { manifest, project, mediaBlobs, buttonBlobs, iconBlob }
}

// Blob URL 생성
export const createMediaUrls = (
  tutorial: LoadedTutorial
): {
  mediaUrls: Record<string, string>
  buttonImageUrls: Record<string, string>
  iconUrl?: string
} => {
  const mediaUrls: Record<string, string> = {}
  const buttonImageUrls: Record<string, string> = {}

  for (const [id, blob] of Object.entries(tutorial.mediaBlobs)) {
    mediaUrls[id] = URL.createObjectURL(blob)
  }

  for (const [id, blob] of Object.entries(tutorial.buttonBlobs)) {
    buttonImageUrls[id] = URL.createObjectURL(blob)
  }

  const iconUrl = tutorial.iconBlob
    ? URL.createObjectURL(tutorial.iconBlob)
    : undefined

  return { mediaUrls, buttonImageUrls, iconUrl }
}

// Blob URL 해제
export const revokeMediaUrls = (urls: Record<string, string>) => {
  for (const url of Object.values(urls)) {
    URL.revokeObjectURL(url)
  }
}

// 파일에서 직접 Blob으로 로드 (File 객체 사용 - 웹 환경용)
export const loadTutorialFromFile = async (
  file: File
): Promise<LoadedTutorial> => {
  const zip = await JSZip.loadAsync(file)

  // manifest.json 읽기
  const manifestFile = zip.file('manifest.json')
  const manifest: TutorialManifest = manifestFile
    ? JSON.parse(await manifestFile.async('text'))
    : {
        version: '1.0.0',
        formatVersion: 1,
        createdAt: 0,
        createdWith: 'Unknown',
        projectName: 'Unknown',
      }

  // project.json 읽기
  const projectFile = zip.file('project.json')
  if (!projectFile) {
    throw new Error('project.json not found in tutorial file')
  }
  const project: Project = JSON.parse(await projectFile.async('text'))

  // 미디어 파일들을 Blob으로 로드
  const mediaBlobs: Record<string, Blob> = {}
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.startsWith('media/') && !file.dir) {
      const blob = await file.async('blob')
      const fileName = path.replace('media/', '')
      const mediaId = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
      mediaBlobs[mediaId] = blob
    }
  }

  // 버튼 이미지 로드
  const buttonBlobs: Record<string, Blob> = {}
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.startsWith('buttons/') && !file.dir) {
      const blob = await file.async('blob')
      const fileName = path.replace('buttons/', '')
      const buttonId = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
      buttonBlobs[buttonId] = blob
    }
  }

  // 앱 아이콘 로드
  let iconBlob: Blob | undefined
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.startsWith('icons/') && !file.dir) {
      iconBlob = await file.async('blob')
      break
    }
  }

  return { manifest, project, mediaBlobs, buttonBlobs, iconBlob }
}
