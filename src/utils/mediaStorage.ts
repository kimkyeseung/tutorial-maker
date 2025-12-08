import type { Project, StoredMedia } from '../types/project'

const DB_NAME = 'tutorial-maker-db'
const DB_VERSION = 1

// Object Stores
const PROJECTS_STORE = 'projects'
const MEDIA_FILES_STORE = 'mediaFiles'
const BUTTON_IMAGES_STORE = 'buttonImages'
const APP_ICONS_STORE = 'appIcons'

// IndexedDB 초기화
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // 프로젝트 저장소
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' })
      }

      // 미디어 파일 저장소 (영상/이미지)
      if (!db.objectStoreNames.contains(MEDIA_FILES_STORE)) {
        db.createObjectStore(MEDIA_FILES_STORE, { keyPath: 'id' })
      }

      // 버튼 이미지 저장소
      if (!db.objectStoreNames.contains(BUTTON_IMAGES_STORE)) {
        db.createObjectStore(BUTTON_IMAGES_STORE, { keyPath: 'id' })
      }

      // 앱 아이콘 저장소
      if (!db.objectStoreNames.contains(APP_ICONS_STORE)) {
        db.createObjectStore(APP_ICONS_STORE, { keyPath: 'id' })
      }
    }
  })
}

// 프로젝트 저장
export const saveProject = async (project: Project): Promise<void> => {
  const db = await initDB()
  const transaction = db.transaction([PROJECTS_STORE], 'readwrite')
  const store = transaction.objectStore(PROJECTS_STORE)

  await new Promise<void>((resolve, reject) => {
    const request = store.put(project)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}

// 프로젝트 불러오기
export const getProject = async (
  projectId: string
): Promise<Project | null> => {
  const db = await initDB()
  const transaction = db.transaction([PROJECTS_STORE], 'readonly')
  const store = transaction.objectStore(PROJECTS_STORE)

  const result = await new Promise<Project | null>((resolve, reject) => {
    const request = store.get(projectId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })

  db.close()
  return result
}

// 모든 프로젝트 목록 가져오기
export const getAllProjects = async (): Promise<Project[]> => {
  const db = await initDB()
  const transaction = db.transaction([PROJECTS_STORE], 'readonly')
  const store = transaction.objectStore(PROJECTS_STORE)

  const result = await new Promise<Project[]>((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })

  db.close()
  return result
}

// 프로젝트 삭제
export const deleteProject = async (projectId: string): Promise<void> => {
  const db = await initDB()
  const transaction = db.transaction([PROJECTS_STORE], 'readwrite')
  const store = transaction.objectStore(PROJECTS_STORE)

  await new Promise<void>((resolve, reject) => {
    const request = store.delete(projectId)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}

// 미디어 파일 저장
export const saveMediaFile = async (
  file: File,
  type: 'video' | 'image'
): Promise<string> => {
  const id = crypto.randomUUID()
  const media: StoredMedia = {
    id,
    name: file.name,
    blob: file,
    type,
    createdAt: Date.now(),
  }

  const db = await initDB()
  const transaction = db.transaction([MEDIA_FILES_STORE], 'readwrite')
  const store = transaction.objectStore(MEDIA_FILES_STORE)

  await new Promise<void>((resolve, reject) => {
    const request = store.put(media)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
  return id
}

// 미디어 파일 가져오기
export const getMediaFile = async (
  mediaId: string
): Promise<StoredMedia | null> => {
  const db = await initDB()
  const transaction = db.transaction([MEDIA_FILES_STORE], 'readonly')
  const store = transaction.objectStore(MEDIA_FILES_STORE)

  const result = await new Promise<StoredMedia | null>((resolve, reject) => {
    const request = store.get(mediaId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })

  db.close()
  return result
}

// 버튼 이미지 저장
export const saveButtonImage = async (file: File): Promise<string> => {
  const id = crypto.randomUUID()
  const media: StoredMedia = {
    id,
    name: file.name,
    blob: file,
    type: 'button',
    createdAt: Date.now(),
  }

  const db = await initDB()
  const transaction = db.transaction([BUTTON_IMAGES_STORE], 'readwrite')
  const store = transaction.objectStore(BUTTON_IMAGES_STORE)

  await new Promise<void>((resolve, reject) => {
    const request = store.put(media)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
  return id
}

// 버튼 이미지 가져오기
export const getButtonImage = async (
  imageId: string
): Promise<StoredMedia | null> => {
  const db = await initDB()
  const transaction = db.transaction([BUTTON_IMAGES_STORE], 'readonly')
  const store = transaction.objectStore(BUTTON_IMAGES_STORE)

  const result = await new Promise<StoredMedia | null>((resolve, reject) => {
    const request = store.get(imageId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })

  db.close()
  return result
}

// 앱 아이콘 저장
export const saveAppIcon = async (file: File): Promise<string> => {
  const id = crypto.randomUUID()
  const media: StoredMedia = {
    id,
    name: file.name,
    blob: file,
    type: 'icon',
    createdAt: Date.now(),
  }

  const db = await initDB()
  const transaction = db.transaction([APP_ICONS_STORE], 'readwrite')
  const store = transaction.objectStore(APP_ICONS_STORE)

  await new Promise<void>((resolve, reject) => {
    const request = store.put(media)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
  return id
}

// 앱 아이콘 가져오기
export const getAppIcon = async (
  iconId: string
): Promise<StoredMedia | null> => {
  const db = await initDB()
  const transaction = db.transaction([APP_ICONS_STORE], 'readonly')
  const store = transaction.objectStore(APP_ICONS_STORE)

  const result = await new Promise<StoredMedia | null>((resolve, reject) => {
    const request = store.get(iconId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })

  db.close()
  return result
}

// Blob URL 생성 헬퍼
export const createBlobURL = (blob: Blob): string => {
  return URL.createObjectURL(blob)
}

// Blob URL 해제 헬퍼
export const revokeBlobURL = (url: string): void => {
  URL.revokeObjectURL(url)
}
