export interface Project {
  id: string
  name: string
  description: string
  appIcon?: string // Blob ID (IndexedDB)
  appTitle: string
  pages: Page[]
  settings: ProjectSettings
  createdAt: number
  updatedAt: number
}

export interface ProjectSettings {
  windowWidth: number
  windowHeight: number
  fullscreen: boolean
  exitKey?: string // "ESC", "F11" 등
  showProgress: boolean // 진행 상황 표시
  showHomeButton: boolean
  showBackButton: boolean
  loopAtEnd: boolean // 마지막 페이지 후 첫 페이지로
}

export interface Page {
  id: string
  order: number
  mediaType: 'video' | 'image'
  mediaId: string // IndexedDB Blob ID
  playType: 'loop' | 'single'
  playCount?: number // single 모드에서 재생 횟수 (1~20, 기본값: 1)
  buttons: PageButton[]
  touchAreas: TouchArea[]
}

export interface PageButton {
  id: string
  imageId: string // IndexedDB Blob ID
  position: { x: number; y: number } // 퍼센트 (0-100)
  size: { width: number; height: number } // 퍼센트 (0-100)
  action: NavigationAction
  showTiming: 'immediate' | 'after-video'
}

export interface TouchArea {
  id: string
  position: { x: number; y: number } // 퍼센트 (0-100)
  size: { width: number; height: number } // 퍼센트 (0-100)
  action: NavigationAction
  showTiming: 'immediate' | 'after-video'
  debugVisible?: boolean // 디버그 모드에서 테두리 표시
}

export interface NavigationAction {
  type: 'next' | 'goto'
  targetPageId?: string // type이 'goto'일 때 사용
}

export interface StoredMedia {
  id: string
  name: string
  blob: Blob
  type: 'video' | 'image' | 'button' | 'icon'
  createdAt: number
}

// 빌드된 프로젝트용 (미디어가 Base64로 포함됨) - 작은 프로젝트용
export interface EmbeddedMedia {
  id: string
  name: string
  mimeType: string
  base64: string
}

export interface BuildProject extends Omit<Project, 'appIcon'> {
  embeddedMedia: EmbeddedMedia[]
  appIconBase64?: string
}

// 바이너리 빌드용 (큰 프로젝트) - 미디어가 exe에 바이너리로 포함됨
export interface MediaManifestEntry {
  id: string
  name: string
  mimeType: string
  offset: number // exe 내 시작 위치
  size: number // 바이트 크기
}

export interface BuildManifest {
  projectJsonOffset: number
  projectJsonSize: number
  media: MediaManifestEntry[]
  appIconOffset?: number
  appIconSize?: number
}

// Rust로 전달할 미디어 정보
export interface MediaBuildInfo {
  id: string
  name: string
  mimeType: string
  filePath: string // 임시 파일 경로
}

// Rust로 전달할 빌드 요청
export interface BinaryBuildRequest {
  project: Omit<Project, 'appIcon'>
  mediaFiles: MediaBuildInfo[]
  appIconPath?: string
}
