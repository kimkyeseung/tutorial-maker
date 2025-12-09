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
