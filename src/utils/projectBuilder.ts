import { save } from '@tauri-apps/plugin-dialog'
import { mkdir, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import type { Project } from '../types/project'
import { getAppIcon, getButtonImage, getMediaFile } from '../utils/mediaStorage'

export interface BuildProgress {
  message: string
  percent?: number
  step?: number
  totalSteps?: number
}

// Tauri API를 동적으로 가져오는 헬퍼 함수
async function getTauriCore() {
  const core = await import('@tauri-apps/api/core')
  return core
}

async function getTauriEvent() {
  const event = await import('@tauri-apps/api/event')
  return event
}

// 미디어 파일 수집 및 임시 저장 공통 함수
async function collectAndSaveMedia(
  project: Project,
  onProgress?: (progress: BuildProgress) => void
): Promise<{
  mediaPaths: string[]
}> {
  const mediaIds = new Set<string>()

  // 페이지 미디어 수집
  for (const page of project.pages) {
    if (page.mediaId) {
      mediaIds.add(page.mediaId)
    }

    // 버튼 이미지 수집
    for (const button of page.buttons) {
      if (button.imageId) {
        mediaIds.add(button.imageId)
      }
    }
  }

  // 앱 아이콘 수집
  if (project.appIcon) {
    mediaIds.add(project.appIcon)
  }

  // 미디어 파일들을 임시 디렉토리에 저장하고 경로 수집
  const mediaPaths: string[] = []
  const tempDirName = `temp_media_${Date.now()}`
  const mediaIdArray = Array.from(mediaIds)
  const totalMedia = mediaIdArray.length

  // Temp 디렉토리 생성
  try {
    await mkdir(tempDirName, {
      baseDir: BaseDirectory.Temp,
      recursive: true,
    })
  } catch (error) {
    console.error('임시 디렉토리 생성 실패:', error)
  }

  for (let i = 0; i < mediaIdArray.length; i++) {
    const mediaId = mediaIdArray[i]

    if (onProgress) {
      onProgress({
        message: `미디어 파일 준비 중... (${i + 1}/${totalMedia})`,
        percent: Math.round(((i + 1) / totalMedia) * 30), // 미디어 준비는 전체의 30%
        step: i + 1,
        totalSteps: totalMedia,
      })
    }

    try {
      // IndexedDB에서 미디어 가져오기
      let media =
        (await getMediaFile(mediaId)) ||
        (await getButtonImage(mediaId)) ||
        (await getAppIcon(mediaId))

      if (media && media.blob) {
        // Blob을 ArrayBuffer로 변환
        const arrayBuffer = await media.blob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        // 임시 파일 경로 생성 (파일명만)
        const fileName = `${mediaId}_${media.name}`
        const filePath = `${tempDirName}/${fileName}`

        // 임시 디렉토리에 파일 저장
        await writeFile(filePath, uint8Array, {
          baseDir: BaseDirectory.Temp,
        })

        // Temp 디렉토리의 절대 경로를 백엔드에 전달
        const { invoke } = await getTauriCore()
        const tempPath = await invoke<string>('get_temp_path', {
          relativePath: filePath,
        })
        mediaPaths.push(tempPath)
      }
    } catch (error) {
      console.error(`미디어 파일 저장 실패 (${mediaId}):`, error)
    }
  }

  return { mediaPaths }
}

// 방법 1: 독립 실행 파일 빌드 (각 프로젝트마다 별도의 exe)
export async function buildStandaloneExecutable(
  project: Project,
  onProgress?: (progress: BuildProgress) => void
): Promise<boolean> {
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

    // Tauri API 동적 로드
    const { invoke } = await getTauriCore()
    const { listen } = await getTauriEvent()

    // 진행 상황 리스너 등록 (Rust에서 오는 이벤트)
    const unlisten = await listen<string>('build-progress', (event) => {
      if (onProgress) {
        // Rust에서 오는 메시지는 30% 이후 진행상황 (빌드 단계)
        onProgress({
          message: event.payload,
          percent: 30 + Math.min(70, 70), // 빌드 단계는 30~100%
        })
      }
    })

    try {
      if (onProgress) {
        onProgress({ message: '미디어 파일 준비 시작...', percent: 0 })
      }

      // 미디어 파일 수집 및 저장
      const { mediaPaths } = await collectAndSaveMedia(project, onProgress)

      if (onProgress) {
        onProgress({ message: '빌드 시작 중...', percent: 30 })
      }

      // 프로젝트 데이터를 JSON으로 변환
      const projectJson = JSON.stringify(project, null, 2)

      // Rust 백엔드 호출 (방법 1)
      const result = await invoke<string>('build_standalone_executable', {
        projectJson,
        outputFile,
        mediaPaths,
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

