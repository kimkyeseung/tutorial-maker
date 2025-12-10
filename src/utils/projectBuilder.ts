import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { save } from '@tauri-apps/plugin-dialog'
import type { Project, BuildProject, EmbeddedMedia } from '../types/project'
import { getAppIcon, getButtonImage, getMediaFile } from '../utils/mediaStorage'

// Tauri 환경 확인 함수
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export interface BuildProgress {
  message: string
  percent?: number
  step?: number
  totalSteps?: number
}

// Blob을 Base64로 변환
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      // data:mime;base64, 부분 제거
      const base64Data = base64.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// MIME 타입 추출
function getMimeType(blob: Blob, mediaType: 'video' | 'image'): string {
  if (blob.type) return blob.type
  return mediaType === 'video' ? 'video/mp4' : 'image/png'
}

// 미디어를 Base64로 변환하여 BuildProject 생성
async function createBuildProject(
  project: Project,
  onProgress?: (progress: BuildProgress) => void
): Promise<BuildProject> {
  const mediaIds = new Set<string>()
  const mediaTypeMap = new Map<string, 'video' | 'image'>()

  // 페이지 미디어 수집
  for (const page of project.pages) {
    if (page.mediaId) {
      mediaIds.add(page.mediaId)
      mediaTypeMap.set(page.mediaId, page.mediaType)
    }

    // 버튼 이미지 수집
    for (const button of page.buttons) {
      if (button.imageId) {
        mediaIds.add(button.imageId)
        mediaTypeMap.set(button.imageId, 'image')
      }
    }
  }

  const mediaIdArray = Array.from(mediaIds)
  const totalMedia = mediaIdArray.length + (project.appIcon ? 1 : 0)
  const embeddedMedia: EmbeddedMedia[] = []

  // 앱 아이콘 처리
  let appIconBase64: string | undefined

  if (project.appIcon) {
    if (onProgress) {
      onProgress({
        message: '앱 아이콘 변환 중...',
        percent: 5,
        step: 1,
        totalSteps: totalMedia,
      })
    }

    try {
      const iconMedia = await getAppIcon(project.appIcon)
      if (iconMedia && iconMedia.blob) {
        appIconBase64 = await blobToBase64(iconMedia.blob)
      }
    } catch (error) {
      console.error('앱 아이콘 변환 실패:', error)
    }
  }

  // 미디어 파일 변환
  for (let i = 0; i < mediaIdArray.length; i++) {
    const mediaId = mediaIdArray[i]

    if (onProgress) {
      onProgress({
        message: `미디어 변환 중... (${i + 1}/${mediaIdArray.length})`,
        percent: Math.round(((i + 1) / totalMedia) * 30),
        step: i + 1 + (project.appIcon ? 1 : 0),
        totalSteps: totalMedia,
      })
    }

    try {
      const media =
        (await getMediaFile(mediaId)) || (await getButtonImage(mediaId))

      if (media && media.blob) {
        const mediaType = mediaTypeMap.get(mediaId) || 'image'
        const base64 = await blobToBase64(media.blob)
        const mimeType = getMimeType(media.blob, mediaType)

        embeddedMedia.push({
          id: mediaId,
          name: media.name,
          mimeType,
          base64,
        })
      }
    } catch (error) {
      console.error(`미디어 변환 실패 (${mediaId}):`, error)
    }
  }

  // BuildProject 생성 (appIcon 제외)
  const { appIcon, ...projectWithoutIcon } = project

  return {
    ...projectWithoutIcon,
    embeddedMedia,
    appIconBase64,
  }
}

// 독립 실행 파일 빌드 (각 프로젝트마다 별도의 exe)
export async function buildStandaloneExecutable(
  project: Project,
  onProgress?: (progress: BuildProgress) => void
): Promise<boolean> {
  // Tauri 환경 확인
  if (!isTauriEnvironment()) {
    console.error('Tauri internals not found:', {
      hasWindow: typeof window !== 'undefined',
      hasTauriInternals:
        typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
      windowKeys:
        typeof window !== 'undefined'
          ? Object.keys(window).filter((k) => k.includes('TAURI'))
          : [],
    })
    throw new Error(
      'Tauri 환경이 아닙니다. 앱을 Tauri 환경에서 실행해주세요. (npm run dev를 사용하세요)'
    )
  }

  console.log('Tauri environment detected, proceeding with build...')

  try {
    // 저장 위치 선택
    const outputFile = await save({
      defaultPath: `${project.name}.exe`,
      filters: [
        {
          name: 'Executable',
          extensions: ['exe'],
        },
      ],
      title: '실행 파일을 저장할 위치를 선택하세요',
    })

    if (!outputFile) {
      return false
    }

    // 진행 상황 리스너 등록 (Rust에서 오는 이벤트)
    const unlisten = await listen<string>('build-progress', (event) => {
      if (onProgress) {
        onProgress({
          message: event.payload,
          percent: 30 + Math.min(70, 70),
        })
      }
    })

    try {
      if (onProgress) {
        onProgress({ message: '미디어 파일 변환 시작...', percent: 0 })
      }

      // 미디어를 Base64로 변환하여 BuildProject 생성
      const buildProject = await createBuildProject(project, onProgress)

      if (onProgress) {
        onProgress({ message: '빌드 시작 중...', percent: 30 })
      }

      // BuildProject를 JSON으로 변환
      const projectJson = JSON.stringify(buildProject)

      // Rust 백엔드 호출 (미디어 경로 불필요)
      const result = await invoke<string>('build_standalone_executable', {
        projectJson,
        outputFile,
        mediaPaths: [], // 더 이상 사용하지 않음
        appIconPath: null,
      })

      if (onProgress) {
        onProgress({ message: '빌드 완료!', percent: 100 })
      }

      console.log('독립 실행 파일 빌드 완료:', result)
      return true
    } finally {
      unlisten()
    }
  } catch (error) {
    console.error('빌드 실패:', error)
    throw error
  }
}
