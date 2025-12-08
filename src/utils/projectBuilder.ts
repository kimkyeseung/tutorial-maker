import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import type { Project } from '../types/project'

export interface BuildProgress {
  message: string
}

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

    // 진행 상황 리스너 등록
    const unlisten = await listen<string>('build-progress', (event) => {
      if (onProgress) {
        onProgress(event.payload)
      }
    })

    try {
      // 프로젝트 데이터를 JSON으로 변환
      const projectJson = JSON.stringify(project, null, 2)

      // Rust 백엔드 호출
      const result = await invoke<string>('build_project', {
        projectJson,
        outputDir,
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
