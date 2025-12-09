import React, { useState, useEffect } from 'react'
import PageEditor from '../components/builder/PageEditor'
import PageList from '../components/builder/PageList'
import FlowMap from '../components/builder/FlowMap'
import ProjectSettings from '../components/builder/ProjectSettings'
import type { Project, Page } from '../types/project'
import { getAllProjects, saveProject } from '../utils/mediaStorage'
import { validateAllPages } from '../utils/pageValidation'
import {
  buildProjectToExecutable,
  buildStandaloneExecutable,
} from '../utils/projectBuilder'
import { exportProject, importProjectFromZip } from '../utils/projectExporter'

type View = 'list' | 'settings' | 'pages'
type PagesViewMode = 'list' | 'flowmap'

const BuilderPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [currentView, setCurrentView] = useState<View>('list')
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildProgress, setBuildProgress] = useState<string>('')
  const [showBuildMethodModal, setShowBuildMethodModal] = useState(false)
  const [pagesViewMode, setPagesViewMode] = useState<PagesViewMode>('list')

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    const allProjects = await getAllProjects()
    setProjects(allProjects)
  }

  const createNewProject = async () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: '새 프로젝트',
      description: '',
      appTitle: '새 프로젝트',
      pages: [],
      settings: {
        windowWidth: 1920,
        windowHeight: 1080,
        fullscreen: true,
        showProgress: false,
        showHomeButton: false,
        showBackButton: false,
        loopAtEnd: true,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await saveProject(newProject)
    await loadProjects()
    setSelectedProject(newProject)
    setCurrentView('settings')
  }

  const handleProjectUpdate = (updates: Partial<Project>) => {
    if (!selectedProject) return

    const updatedProject = {
      ...selectedProject,
      ...updates,
      updatedAt: Date.now(),
    }
    setSelectedProject(updatedProject)
  }

  const handleSaveProject = async () => {
    if (!selectedProject) return

    await saveProject(selectedProject)
    await loadProjects()
    alert('프로젝트가 저장되었습니다!')
  }

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project)
    setCurrentView('settings')
  }

  const handleBackToList = () => {
    setSelectedProject(null)
    setCurrentView('list')
  }

  const handleExportProject = async () => {
    if (!selectedProject) return

    try {
      // 프로젝트 저장 먼저 수행
      await saveProject(selectedProject)

      // 사용자에게 시작 알림
      const confirmed = confirm(
        '프로젝트를 ZIP 파일로 내보내시겠습니까?\n\n' +
          '프로젝트 데이터와 모든 미디어 파일이 포함된 ZIP 파일이 자동으로 다운로드됩니다.'
      )

      if (!confirmed) return

      // ZIP 파일로 내보내기 (자동 다운로드)
      const success = await exportProject(selectedProject)

      if (success) {
        alert(
          '✅ 프로젝트가 성공적으로 내보내졌습니다!\n\nZIP 파일이 다운로드 폴더에 저장되었습니다.'
        )
      } else {
        alert('❌ 프로젝트 내보내기에 실패했습니다.')
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert(
        '❌ 프로젝트 내보내기에 실패했습니다.\n\n오류: ' +
          (error as Error).message
      )
    }
  }

  const handleShowBuildOptions = async () => {
    if (!selectedProject) return

    // 페이지가 없는 경우 체크
    if (selectedProject.pages.length === 0) {
      alert('❌ 빌드할 수 없습니다.\n\n페이지가 없습니다. 최소 1개 이상의 페이지를 추가해주세요.')
      return
    }

    // 페이지 유효성 검사
    const validation = validateAllPages(selectedProject.pages)
    if (!validation.isValid) {
      const errorMessages = validation.invalidPages
        .map(({ pageIndex, errors }) => `페이지 ${pageIndex + 1}: ${errors.join(', ')}`)
        .join('\n')

      alert(`❌ 빌드할 수 없습니다.\n\n다음 페이지에 문제가 있습니다:\n${errorMessages}`)
      return
    }

    // 프로젝트 저장 먼저 수행
    await saveProject(selectedProject)

    // 빌드 방법 선택 모달 표시
    setShowBuildMethodModal(true)
  }

  const handleBuildStandalone = async () => {
    if (!selectedProject) return

    setShowBuildMethodModal(false)

    try {
      setIsBuilding(true)
      setBuildProgress('독립 실행 파일 빌드를 시작합니다...')

      const success = await buildStandaloneExecutable(
        selectedProject,
        (message) => {
          setBuildProgress(message)
        }
      )

      setIsBuilding(false)

      if (success) {
        alert(
          '✅ 독립 실행 파일 빌드가 완료되었습니다!\n\n' +
            '선택한 위치에 실행 파일과 미디어 파일이 생성되었습니다.'
        )
      } else {
        alert('❌ 프로젝트 빌드에 실패했습니다.')
      }
    } catch (error) {
      console.error('Build failed:', error)
      setIsBuilding(false)
      alert(
        '❌ 프로젝트 빌드에 실패했습니다.\n\n오류: ' + (error as Error).message
      )
    } finally {
      setBuildProgress('')
    }
  }

  const handleBuildViewer = async () => {
    if (!selectedProject) return

    setShowBuildMethodModal(false)

    try {
      setIsBuilding(true)
      setBuildProgress('뷰어 앱 방식 빌드를 시작합니다...')

      const success = await buildProjectToExecutable(
        selectedProject,
        (message) => {
          setBuildProgress(message)
        }
      )

      setIsBuilding(false)

      if (success) {
        alert(
          '✅ 프로젝트 빌드가 완료되었습니다!\n\n' +
            '선택한 폴더에 실행 파일과 프로젝트 데이터가 생성되었습니다.'
        )
      } else {
        alert('❌ 프로젝트 빌드에 실패했습니다.')
      }
    } catch (error) {
      console.error('Build failed:', error)
      setIsBuilding(false)
      alert(
        '❌ 프로젝트 빌드에 실패했습니다.\n\n오류: ' + (error as Error).message
      )
    } finally {
      setBuildProgress('')
    }
  }

  const handleImportProject = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const project = await importProjectFromZip(file)

        if (project) {
          await loadProjects()
          alert('프로젝트를 성공적으로 가져왔습니다!')
          setSelectedProject(project)
          setCurrentView('settings')
        } else {
          alert('프로젝트 가져오기에 실패했습니다.')
        }
      } catch (error) {
        console.error('Import failed:', error)
        alert('프로젝트 가져오기에 실패했습니다.')
      }
    }

    input.click()
  }

  // 페이지 관리 함수들
  const handleAddPage = () => {
    if (!selectedProject) return

    const newPage: Page = {
      id: crypto.randomUUID(),
      order: selectedProject.pages.length,
      mediaType: 'video',
      mediaId: '',
      playType: 'loop',
      buttons: [],
      touchAreas: [],
    }

    const updatedProject = {
      ...selectedProject,
      pages: [...selectedProject.pages, newPage],
      updatedAt: Date.now(),
    }

    setSelectedProject(updatedProject)
    setSelectedPageId(newPage.id)
  }

  const handleSelectPage = (pageId: string) => {
    setSelectedPageId(pageId)
  }

  const handleDeletePage = (pageId: string) => {
    if (!selectedProject) return

    const updatedPages = selectedProject.pages
      .filter((p) => p.id !== pageId)
      .map((p, index) => ({ ...p, order: index }))

    const updatedProject = {
      ...selectedProject,
      pages: updatedPages,
      updatedAt: Date.now(),
    }

    setSelectedProject(updatedProject)

    if (selectedPageId === pageId) {
      setSelectedPageId(updatedPages.length > 0 ? updatedPages[0].id : null)
    }
  }

  const handlePageUpdate = (updates: Partial<Page>) => {
    if (!selectedProject || !selectedPageId) return

    const updatedPages = selectedProject.pages.map((page) =>
      page.id === selectedPageId ? { ...page, ...updates } : page
    )

    const updatedProject = {
      ...selectedProject,
      pages: updatedPages,
      updatedAt: Date.now(),
    }

    setSelectedProject(updatedProject)
  }

  const handleReorderPages = (startIndex: number, endIndex: number) => {
    if (!selectedProject) return

    const pages = Array.from(selectedProject.pages)
    const [removed] = pages.splice(startIndex, 1)
    pages.splice(endIndex, 0, removed)

    const reorderedPages = pages.map((page, index) => ({
      ...page,
      order: index,
    }))

    const updatedProject = {
      ...selectedProject,
      pages: reorderedPages,
      updatedAt: Date.now(),
    }

    setSelectedProject(updatedProject)
  }

  const selectedPage =
    selectedProject?.pages.find((p) => p.id === selectedPageId) || null

  return (
    <div className='min-h-screen bg-gray-100'>
      {/* 헤더 */}
      <header className='bg-white shadow-sm'>
        <div className='mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between'>
            <h1 className='text-2xl font-bold text-gray-900'>Tutorial Maker</h1>
            <div className='flex gap-2'>
              <button
                onClick={handleImportProject}
                className='flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700'
              >
                📥 프로젝트 가져오기
              </button>
              <button
                onClick={createNewProject}
                className='rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700'
              >
                새 프로젝트
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 빌드 방법 선택 모달 */}
      {showBuildMethodModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='mx-4 w-full max-w-2xl rounded-lg bg-white p-8'>
            <h3 className='mb-6 text-2xl font-bold'>빌드 방법 선택</h3>
            <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-2'>
              {/* 방법 1: 독립 실행 파일 */}
              <button
                onClick={handleBuildStandalone}
                className='rounded-lg border-2 border-purple-600 bg-purple-50 p-6 text-left transition-all hover:bg-purple-100 hover:shadow-lg'
              >
                <div className='mb-2 text-3xl'>🏗️</div>
                <h4 className='mb-2 text-lg font-bold text-purple-900'>
                  방법 1: 독립 실행 파일
                </h4>
                <p className='mb-3 text-sm text-gray-700'>
                  프로젝트마다 별도의 실행 파일을 빌드합니다.
                </p>
                <ul className='space-y-1 text-xs text-gray-600'>
                  <li>✅ 완전히 독립적인 실행 파일</li>
                  <li>✅ 다른 프로젝트에 영향 없음</li>
                  <li>⚠️ 빌드 시간이 오래 걸림 (5-10분)</li>
                  <li>⚠️ 파일 크기가 큼 (50-100MB)</li>
                </ul>
              </button>

              {/* 방법 2: 뷰어 앱 방식 */}
              <button
                onClick={handleBuildViewer}
                className='rounded-lg border-2 border-blue-600 bg-blue-50 p-6 text-left transition-all hover:bg-blue-100 hover:shadow-lg'
              >
                <div className='mb-2 text-3xl'>⚡</div>
                <h4 className='mb-2 text-lg font-bold text-blue-900'>
                  방법 2: 뷰어 앱 방식
                </h4>
                <p className='mb-3 text-sm text-gray-700'>
                  현재 앱을 복사하고 프로젝트 데이터를 함께 패키징합니다.
                </p>
                <ul className='space-y-1 text-xs text-gray-600'>
                  <li>✅ 빠른 빌드 (10-30초)</li>
                  <li>✅ 즉시 배포 가능</li>
                  <li>⚠️ 현재 앱 버전에 종속적</li>
                  <li>⚠️ 여러 프로젝트 동시 관리 시 유용</li>
                </ul>
              </button>
            </div>
            <div className='text-center'>
              <button
                onClick={() => setShowBuildMethodModal(false)}
                className='rounded-lg bg-gray-300 px-6 py-2 text-gray-700 transition-colors hover:bg-gray-400'
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 빌드 진행 상황 모달 */}
      {isBuilding && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='mx-4 w-full max-w-md rounded-lg bg-white p-8'>
            <h3 className='mb-4 text-xl font-bold'>프로젝트 빌드 중</h3>
            <div className='mb-4'>
              <div className='flex animate-pulse space-x-2'>
                <div className='h-2 flex-1 rounded bg-purple-600'></div>
                <div className='h-2 flex-1 rounded bg-purple-600'></div>
                <div className='h-2 flex-1 rounded bg-purple-600'></div>
              </div>
            </div>
            <p className='text-sm text-gray-600'>{buildProgress}</p>
            <p className='mt-2 text-xs text-gray-500'>
              잠시만 기다려주세요. 빌드가 완료될 때까지 창을 닫지 마세요.
            </p>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <main className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
        {currentView === 'list' ? (
          <div>
            <h2 className='mb-4 text-xl font-semibold'>프로젝트 목록</h2>
            {projects.length === 0 ? (
              <div className='rounded-lg bg-white p-8 text-center shadow'>
                <p className='mb-4 text-gray-500'>
                  아직 프로젝트가 없습니다. 새 프로젝트를 만들어보세요!
                </p>
                <button
                  onClick={createNewProject}
                  className='rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700'
                >
                  첫 프로젝트 만들기
                </button>
              </div>
            ) : (
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
                {projects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleSelectProject(project)}
                    className='cursor-pointer rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg'
                  >
                    <h3 className='mb-2 text-lg font-semibold'>
                      {project.name}
                    </h3>
                    <p className='mb-4 text-sm text-gray-600'>
                      {project.description || '설명 없음'}
                    </p>
                    <div className='text-xs text-gray-500'>
                      페이지: {project.pages.length}개
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : currentView === 'settings' && selectedProject ? (
          <div>
            <div className='mb-4 flex items-center justify-between'>
              <button
                onClick={handleBackToList}
                className='flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800'
              >
                ← 프로젝트 목록으로
              </button>
              <div className='flex gap-2'>
                <button
                  onClick={handleExportProject}
                  disabled={isBuilding}
                  className='flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  📦 ZIP으로 내보내기
                </button>
                <button
                  onClick={handleShowBuildOptions}
                  disabled={isBuilding}
                  className='flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {isBuilding ? '🔨 빌드 중...' : '🚀 실행 파일 빌드'}
                </button>
              </div>
            </div>
            <ProjectSettings
              project={selectedProject}
              onUpdate={handleProjectUpdate}
              onSave={handleSaveProject}
            />
            <div className='mt-6 text-center'>
              <button
                onClick={() => setCurrentView('pages')}
                className='rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700'
              >
                페이지 편집하기 →
              </button>
            </div>
          </div>
        ) : currentView === 'pages' && selectedProject ? (
          <div>
            <div className='mb-4 flex items-center justify-between'>
              <button
                onClick={() => setCurrentView('settings')}
                className='flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800'
              >
                ← 프로젝트 설정으로
              </button>
              <div className='flex gap-2'>
                {/* 뷰 모드 토글 */}
                <div className='flex rounded-lg border border-gray-300 bg-white'>
                  <button
                    onClick={() => setPagesViewMode('list')}
                    className={`flex items-center gap-1 px-3 py-2 text-sm transition-colors ${
                      pagesViewMode === 'list'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    } rounded-l-lg`}
                  >
                    📋 목록
                  </button>
                  <button
                    onClick={() => setPagesViewMode('flowmap')}
                    className={`flex items-center gap-1 px-3 py-2 text-sm transition-colors ${
                      pagesViewMode === 'flowmap'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    } rounded-r-lg`}
                  >
                    🗺️ 흐름도
                  </button>
                </div>
                <button
                  onClick={handleExportProject}
                  disabled={isBuilding}
                  className='flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  📦 ZIP으로 내보내기
                </button>
                <button
                  onClick={handleShowBuildOptions}
                  disabled={isBuilding}
                  className='flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {isBuilding ? '🔨 빌드 중...' : '🚀 실행 파일 빌드'}
                </button>
                <button
                  onClick={handleSaveProject}
                  disabled={isBuilding}
                  className='rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  저장
                </button>
              </div>
            </div>

            {/* 흐름도 뷰 */}
            {pagesViewMode === 'flowmap' && (
              <div className='mb-6'>
                <FlowMap
                  pages={selectedProject.pages}
                  onSelectPage={(pageId) => {
                    handleSelectPage(pageId)
                    setPagesViewMode('list') // 클릭 시 목록 뷰로 전환하여 편집
                  }}
                  loopAtEnd={selectedProject.settings.loopAtEnd}
                />
              </div>
            )}

            {/* 목록 뷰 */}
            {pagesViewMode === 'list' && (
              <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
                {/* 왼쪽: 페이지 목록 */}
                <div className='lg:col-span-1'>
                  <PageList
                    pages={selectedProject.pages}
                    selectedPageId={selectedPageId}
                    onSelectPage={handleSelectPage}
                    onAddPage={handleAddPage}
                    onDeletePage={handleDeletePage}
                    onReorderPages={handleReorderPages}
                  />
                </div>

                {/* 오른쪽: 페이지 편집기 */}
                <div className='lg:col-span-2'>
                  <PageEditor
                    page={selectedPage}
                    onUpdate={handlePageUpdate}
                    totalPages={selectedProject.pages.length}
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default BuilderPage
