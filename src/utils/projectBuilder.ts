import { open, save } from '@tauri-apps/plugin-dialog'
import { mkdir, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import type { Project } from '../types/project'
import { getAppIcon, getButtonImage, getMediaFile } from '../utils/mediaStorage'

export interface BuildProgress {
  message: string
}

export type BuildMethod = 'standalone' | 'viewer'

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
async function collectAndSaveMedia(project: Project): Promise<{
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

  // Temp 디렉토리 생성
  try {
    await mkdir(tempDirName, {
      baseDir: BaseDirectory.Temp,
      recursive: true,
    })
  } catch (error) {
    console.error('임시 디렉토리 생성 실패:', error)
  }

  for (const mediaId of mediaIds) {
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
  onProgress?: (message: string) => void
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

    // 진행 상황 리스너 등록
    const unlisten = await listen<string>('build-progress', (event) => {
      if (onProgress) {
        onProgress(event.payload)
      }
    })

    try {
      if (onProgress) {
        onProgress('미디어 파일 준비 중...')
      }

      // 미디어 파일 수집 및 저장
      const { mediaPaths } = await collectAndSaveMedia(project)

      // 프로젝트 데이터를 JSON으로 변환
      const projectJson = JSON.stringify(project, null, 2)

      // Rust 백엔드 호출 (방법 1)
      const result = await invoke<string>('build_standalone_executable', {
        projectJson,
        outputFile,
        mediaPaths,
      })

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

// 방법 2: 뷰어 앱 방식 (현재 실행 파일 + 프로젝트 데이터)
export async function buildProjectToExecutable(
  project: Project,
  onProgress?: (message: string) => void
): Promise<boolean> {
  try {
    // 출력 디렉토리 선택
    const outputDir = await open({
      directory: true,
      multiple: false,
      title: '빌드 결과를 저장할 폴더를 선택하세요',
    })

    if (!outputDir) {
      return false
    }

    // Tauri API 동적 로드
    const { invoke } = await getTauriCore()
    const { listen } = await getTauriEvent()

    // 진행 상황 리스너 등록
    const unlisten = await listen<string>('build-progress', (event) => {
      if (onProgress) {
        onProgress(event.payload)
      }
    })

    try {
      if (onProgress) {
        onProgress('미디어 파일 준비 중...')
      }

      // 미디어 파일 수집 및 저장
      const { mediaPaths } = await collectAndSaveMedia(project)

      // 프로젝트 데이터를 JSON으로 변환
      const projectJson = JSON.stringify(project, null, 2)

      // Rust 백엔드 호출 (방법 2)
      const result = await invoke<string>('build_project', {
        projectJson,
        outputDir,
        mediaPaths,
      })

      console.log('빌드 완료:', result)
      return true
    } finally {
      // 리스너 해제
      unlisten()
    }
  } catch (error) {
    console.error('빌드 실패:', error)
    throw error
  }
}
