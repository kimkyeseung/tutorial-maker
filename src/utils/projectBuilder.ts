import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile, mkdir } from '@tauri-apps/plugin-fs'
import type { Project, MediaBuildInfo } from '../types/project'
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

// MIME 타입 추출
function getMimeType(blob: Blob, mediaType: 'video' | 'image'): string {
  if (blob.type) return blob.type
  return mediaType === 'video' ? 'video/mp4' : 'image/png'
}

// 미디어 파일 확장자 결정
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/avi': '.avi',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
  }
  return map[mimeType] || ''
}

// 미디어 파일들을 임시 폴더에 저장하고 정보 반환
async function prepareMediaFiles(
  project: Project,
  tempDir: string,
  onProgress?: (progress: BuildProgress) => void
): Promise<{ mediaFiles: MediaBuildInfo[]; appIconPath?: string }> {
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
  const mediaFiles: MediaBuildInfo[] = []

  // 미디어 임시 폴더 생성
  const mediaDir = `${tempDir}/media`
  await mkdir(mediaDir, { recursive: true })

  // 앱 아이콘 처리
  let appIconPath: string | undefined

  if (project.appIcon) {
    if (onProgress) {
      onProgress({
        message: '앱 아이콘 저장 중...',
        percent: 5,
        step: 1,
        totalSteps: totalMedia,
      })
    }

    try {
      const iconMedia = await getAppIcon(project.appIcon)
      if (iconMedia && iconMedia.blob) {
        const iconPath = `${tempDir}/app_icon.png`
        const arrayBuffer = await iconMedia.blob.arrayBuffer()
        await writeFile(iconPath, new Uint8Array(arrayBuffer))
        appIconPath = iconPath
      }
    } catch (error) {
      console.error('앱 아이콘 저장 실패:', error)
    }
  }

  // 미디어 파일 저장
  for (let i = 0; i < mediaIdArray.length; i++) {
    const mediaId = mediaIdArray[i]

    if (onProgress) {
      onProgress({
        message: `미디어 파일 준비 중... (${i + 1}/${mediaIdArray.length})`,
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
        const mimeType = getMimeType(media.blob, mediaType)
        const ext = getExtension(mimeType)
        const filePath = `${mediaDir}/${mediaId}${ext}`

        // Blob을 파일로 저장
        const arrayBuffer = await media.blob.arrayBuffer()
        await writeFile(filePath, new Uint8Array(arrayBuffer))

        mediaFiles.push({
          id: mediaId,
          name: media.name,
          mimeType,
          filePath,
        })
      }
    } catch (error) {
      console.error(`미디어 파일 저장 실패 (${mediaId}):`, error)
    }
  }

  return { mediaFiles, appIconPath }
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
        onProgress({ message: '임시 폴더 생성 중...', percent: 0 })
      }

      // 임시 디렉토리 경로 가져오기
      const buildTempDir = await invoke<string>('get_temp_path', {
        relativePath: `tutorial_maker_build_${Date.now()}`,
      })
      await mkdir(buildTempDir, { recursive: true })

      if (onProgress) {
        onProgress({ message: '미디어 파일 준비 시작...', percent: 5 })
      }

      // 미디어 파일들을 임시 폴더에 저장
      const { mediaFiles, appIconPath } = await prepareMediaFiles(
        project,
        buildTempDir,
        onProgress
      )

      if (onProgress) {
        onProgress({ message: '빌드 시작 중...', percent: 30 })
      }

      // 프로젝트 데이터 (appIcon 제외)
      const { appIcon, ...projectWithoutIcon } = project
      const projectJson = JSON.stringify(projectWithoutIcon)

      // 미디어 파일 정보 배열
      const mediaInfoJson = JSON.stringify(mediaFiles)

      // Rust 백엔드 호출
      const result = await invoke<string>('build_standalone_executable_v2', {
        projectJson,
        mediaInfoJson,
        outputFile,
        appIconPath: appIconPath || null,
        tempDir: buildTempDir,
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
