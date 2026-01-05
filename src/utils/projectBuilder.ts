import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile, mkdir } from '@tauri-apps/plugin-fs'

import type { Project, MediaBuildInfo } from '../types/project'
import { getAppIcon, getButtonImage, getMediaFile } from '../utils/mediaStorage'
import {
  canCompress,
  compressVideo,
  analyzeVideo,
  CompressionProgress,
} from '../utils/videoCompressor'

// Tauri 환경 확인 함수
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export interface BuildProgress {
  message: string
  percent?: number
  step?: number
  totalSteps?: number
  /** 압축 관련 정보 */
  compressionInfo?: {
    fileId: string
    originalSize: number
    compressedSize?: number
    stage?: CompressionProgress['stage']
    /** 현재 압축 중인 영상 번호 (1부터 시작) */
    currentVideoIndex?: number
    /** 전체 영상 수 */
    totalVideos?: number
    /** 영상 압축 진행률 (0-100) */
    videoPercent?: number
  }
}

export interface BuildOptions {
  /** 비디오 압축 활성화 (기본값: true) */
  enableCompression?: boolean
  /** 압축 품질 (기본값: 'high') */
  compressionQuality?: 'low' | 'medium' | 'high'
  /** 최대 해상도 (기본값: 1080) */
  maxResolution?: number
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

/**
 * 비디오 압축이 필요한지 확인
 */
async function needsVideoCompression(blob: Blob): Promise<boolean> {
  try {
    const metadata = await analyzeVideo(blob)
    // 해상도가 1080p 초과이거나 비트레이트가 2.5Mbps 초과인 경우 압축 필요
    return (
      metadata.width > 1080 ||
      metadata.height > 1080 ||
      metadata.estimatedBitrate > 2_500_000
    )
  } catch {
    return false
  }
}

/**
 * 비디오 압축 처리
 */
async function processVideoCompression(
  blob: Blob,
  mediaId: string,
  options: BuildOptions,
  currentVideoIndex: number,
  totalVideos: number,
  onProgress?: (progress: BuildProgress) => void
): Promise<Blob> {
  if (!options.enableCompression || !canCompress()) {
    return blob
  }

  try {
    const needsCompression = await needsVideoCompression(blob)

    if (!needsCompression) {
      return blob
    }

    const result = await compressVideo(
      blob,
      {
        maxResolution: options.maxResolution || 1080,
        quality: options.compressionQuality || 'high',
      },
      (progress) => {
        onProgress?.({
          message: `영상 압축 중... (${currentVideoIndex}/${totalVideos})`,
          percent: progress.percent,
          compressionInfo: {
            fileId: mediaId,
            originalSize: blob.size,
            stage: progress.stage,
            currentVideoIndex,
            totalVideos,
            videoPercent: progress.percent,
          },
        })
      }
    )

    // 압축이 효과적인 경우에만 압축된 파일 사용
    if (result.compressionRatio > 5) {
      onProgress?.({
        message: `압축 완료 (${currentVideoIndex}/${totalVideos}): ${formatFileSize(blob.size)} → ${formatFileSize(result.compressedSize)}`,
        compressionInfo: {
          fileId: mediaId,
          originalSize: blob.size,
          compressedSize: result.compressedSize,
          currentVideoIndex,
          totalVideos,
          videoPercent: 100,
        },
      })
      return result.blob
    }

    return blob
  } catch (error) {
    console.warn(`비디오 압축 실패 (${mediaId}), 원본 사용:`, error)
    return blob
  }
}

/**
 * 파일 크기 포맷팅
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 프로젝트 JSON을 청크 단위로 파일에 쓰기
 * 대용량 프로젝트에서 "invalid string length" 에러 방지
 */
async function writeProjectJsonToFile(
  project: Omit<Project, 'appIcon'>,
  filePath: string
): Promise<void> {
  // 기본 프로젝트 정보
  const baseProject = {
    id: project.id,
    name: project.name,
    description: project.description,
    appTitle: project.appTitle,
    settings: project.settings,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }

  // 페이지를 개별적으로 직렬화
  const pageJsons: string[] = []
  for (const page of project.pages) {
    try {
      pageJsons.push(JSON.stringify(page))
    } catch {
      // 개별 페이지 직렬화 실패 시 간소화
      const simplePage = {
        id: page.id,
        order: page.order,
        mediaType: page.mediaType,
        mediaId: page.mediaId,
        playType: page.playType,
        playCount: page.playCount,
        buttons: page.buttons.map((b) => ({
          id: b.id,
          imageId: b.imageId,
          position: b.position,
          size: b.size,
          action: b.action,
          showTiming: b.showTiming,
        })),
        touchAreas: page.touchAreas.map((t) => ({
          id: t.id,
          position: t.position,
          size: t.size,
          action: t.action,
          showTiming: t.showTiming,
        })),
      }
      pageJsons.push(JSON.stringify(simplePage))
    }
  }

  // 최종 JSON 조합
  const baseJson = JSON.stringify(baseProject)
  const pagesJson = `[${pageJsons.join(',')}]`

  // 전체 JSON 조합
  const fullJson = baseJson.slice(0, -1) + `,"pages":${pagesJson}}`

  // 파일에 쓰기
  await writeFile(filePath, new TextEncoder().encode(fullJson))
}

// 미디어 파일들을 임시 폴더에 저장하고 정보 반환
async function prepareMediaFiles(
  project: Project,
  tempDir: string,
  options: BuildOptions = {},
  onProgress?: (progress: BuildProgress) => void
): Promise<{ mediaFiles: MediaBuildInfo[]; appIconPath?: string; compressionStats: CompressionStats }> {
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

  // 비디오 파일 수 계산
  const videoIds = mediaIdArray.filter((id) => mediaTypeMap.get(id) === 'video')
  const totalVideos = videoIds.length

  // 압축 통계
  const compressionStats: CompressionStats = {
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    compressedCount: 0,
    skippedCount: 0,
  }

  // 현재 처리 중인 비디오 인덱스
  let currentVideoIndex = 0

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
        let blobToSave = media.blob
        const originalSize = media.blob.size

        // 비디오인 경우 압축 처리
        if (mediaType === 'video' && options.enableCompression !== false) {
          currentVideoIndex++
          const currentIdx = currentVideoIndex

          onProgress?.({
            message: `영상 압축 중... (${currentIdx}/${totalVideos})`,
            percent: Math.round(((i + 0.5) / totalMedia) * 30),
            compressionInfo: {
              fileId: mediaId,
              originalSize: originalSize,
              currentVideoIndex: currentIdx,
              totalVideos: totalVideos,
              videoPercent: 0,
            },
          })

          const compressedBlob = await processVideoCompression(
            media.blob,
            mediaId,
            options,
            currentIdx,
            totalVideos,
            onProgress
          )

          if (compressedBlob !== media.blob) {
            blobToSave = compressedBlob
            compressionStats.compressedCount++
            compressionStats.totalOriginalSize += originalSize
            compressionStats.totalCompressedSize += compressedBlob.size
          } else {
            compressionStats.skippedCount++
            compressionStats.totalOriginalSize += originalSize
            compressionStats.totalCompressedSize += originalSize
          }
        } else {
          compressionStats.totalOriginalSize += originalSize
          compressionStats.totalCompressedSize += originalSize
        }

        const mimeType = getMimeType(blobToSave, mediaType)
        const ext = getExtension(mimeType)
        const filePath = `${mediaDir}/${mediaId}${ext}`

        // Blob을 파일로 저장
        const arrayBuffer = await blobToSave.arrayBuffer()
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

  return { mediaFiles, appIconPath, compressionStats }
}

export interface CompressionStats {
  totalOriginalSize: number
  totalCompressedSize: number
  compressedCount: number
  skippedCount: number
}

// 독립 실행 파일 빌드 (각 프로젝트마다 별도의 exe)
export async function buildStandaloneExecutable(
  project: Project,
  onProgress?: (progress: BuildProgress) => void,
  options: BuildOptions = {}
): Promise<{ success: boolean; compressionStats?: CompressionStats }> {
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
      return { success: false }
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

      // 미디어 파일들을 임시 폴더에 저장 (압축 포함)
      const { mediaFiles, appIconPath, compressionStats } = await prepareMediaFiles(
        project,
        buildTempDir,
        options,
        onProgress
      )

      // 압축 결과 로그
      if (compressionStats.compressedCount > 0) {
        const savedSize = compressionStats.totalOriginalSize - compressionStats.totalCompressedSize
        const savedPercent = Math.round((savedSize / compressionStats.totalOriginalSize) * 100)
        console.log(
          `압축 완료: ${compressionStats.compressedCount}개 영상, ` +
          `${formatFileSize(compressionStats.totalOriginalSize)} → ${formatFileSize(compressionStats.totalCompressedSize)} ` +
          `(${savedPercent}% 절약)`
        )

        onProgress?.({
          message: `압축 완료: ${formatFileSize(savedSize)} 절약 (${savedPercent}%)`,
          percent: 30,
        })
      }

      if (onProgress) {
        onProgress({ message: '빌드 시작 중...', percent: 30 })
      }

      // 프로젝트 데이터를 파일로 저장 (대용량 JSON 처리를 위해)
      // JSON.stringify가 메모리에서 처리되므로 청크 단위로 파일에 쓰기
      const { appIcon, ...projectWithoutIcon } = project
      const projectJsonPath = `${buildTempDir}/project.json`
      const mediaInfoPath = `${buildTempDir}/media_info.json`

      try {
        // 프로젝트 JSON 파일로 저장
        await writeProjectJsonToFile(projectWithoutIcon, projectJsonPath)

        // 미디어 정보 JSON 파일로 저장
        const mediaInfoJson = JSON.stringify(mediaFiles)
        await writeFile(mediaInfoPath, new TextEncoder().encode(mediaInfoJson))
      } catch (jsonError) {
        // JSON 직렬화 실패 시 (invalid string length 등)
        console.error('JSON 직렬화 실패:', jsonError)
        throw new Error(
          '프로젝트 데이터가 너무 큽니다. 일부 영상을 압축하거나 페이지 수를 줄여주세요.'
        )
      }

      // Rust 백엔드 호출 (파일 경로 전달)
      const result = await invoke<string>('build_standalone_executable_v3', {
        projectJsonPath,
        mediaInfoPath,
        outputFile,
        appIconPath: appIconPath || null,
        tempDir: buildTempDir,
      })

      if (onProgress) {
        onProgress({ message: '빌드 완료!', percent: 100 })
      }

      console.log('독립 실행 파일 빌드 완료:', result)
      return { success: true, compressionStats }
    } finally {
      unlisten()
    }
  } catch (error) {
    console.error('빌드 실패:', error)
    // Tauri에서 오는 에러는 문자열일 수 있음
    if (typeof error === 'string') {
      throw new Error(error)
    }
    throw error
  }
}
