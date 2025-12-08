import React, { useState, useEffect } from 'react'
import type {
  Project,
  ProjectSettings as ProjectSettingsType,
} from '../../types/project'
import {
  saveAppIcon,
  getAppIcon,
  createBlobURL,
} from '../../utils/mediaStorage'

type ProjectSettingsProps = {
  project: Project
  onUpdate: (updates: Partial<Project>) => void
  onSave: () => void
}

const ProjectSettings: React.FC<ProjectSettingsProps> = ({
  project,
  onUpdate,
  onSave,
}) => {
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    loadIconPreview()
  }, [project.appIcon])

  const loadIconPreview = async () => {
    if (project.appIcon) {
      const iconMedia = await getAppIcon(project.appIcon)
      if (iconMedia) {
        setIconPreview(createBlobURL(iconMedia.blob))
      }
    }
  }

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const iconId = await saveAppIcon(file)
      onUpdate({ appIcon: iconId })
    } catch (error) {
      console.error('Failed to upload icon:', error)
      alert('아이콘 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSettingsChange = (key: keyof ProjectSettingsType, value: any) => {
    onUpdate({
      settings: {
        ...project.settings,
        [key]: value,
      },
    })
  }

  return (
    <div className='mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-lg'>
      <div className='mb-6 flex items-center justify-between'>
        <h2 className='text-2xl font-bold text-gray-900'>프로젝트 설정</h2>
        <button
          onClick={onSave}
          className='rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700'
        >
          저장
        </button>
      </div>

      <div className='space-y-6'>
        {/* 기본 정보 */}
        <section>
          <h3 className='mb-4 text-lg font-semibold text-gray-800'>
            기본 정보
          </h3>

          <div className='space-y-4'>
            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                프로젝트명
              </label>
              <input
                type='text'
                value={project.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500'
                placeholder='프로젝트 이름을 입력하세요'
              />
            </div>

            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                설명
              </label>
              <textarea
                value={project.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500'
                placeholder='프로젝트 설명 (선택사항)'
                rows={3}
              />
            </div>

            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                앱 타이틀
              </label>
              <input
                type='text'
                value={project.appTitle}
                onChange={(e) => onUpdate({ appTitle: e.target.value })}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500'
                placeholder='실행 시 표시될 앱 이름'
              />
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                앱 아이콘 (512x512 이상 권장)
              </label>
              <div className='flex items-center gap-4'>
                {iconPreview && (
                  <img
                    src={iconPreview}
                    alt='App Icon'
                    className='h-20 w-20 rounded-lg border-2 border-gray-300 object-cover'
                  />
                )}
                <label className='cursor-pointer'>
                  <div className='rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200'>
                    {isUploading ? '업로드 중...' : '아이콘 선택'}
                  </div>
                  <input
                    type='file'
                    accept='image/png,image/jpeg'
                    onChange={handleIconUpload}
                    className='hidden'
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* 창 설정 */}
        <section className='border-t border-gray-200 pt-6'>
          <h3 className='mb-4 text-lg font-semibold text-gray-800'>창 설정</h3>

          <div className='space-y-4'>
            <div className='flex items-center gap-4'>
              <label className='flex cursor-pointer items-center'>
                <input
                  type='checkbox'
                  checked={project.settings.fullscreen}
                  onChange={(e) =>
                    handleSettingsChange('fullscreen', e.target.checked)
                  }
                  className='h-4 w-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500'
                />
                <span className='ml-2 text-sm font-medium text-gray-700'>
                  전체화면 모드
                </span>
              </label>
            </div>

            {!project.settings.fullscreen && (
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='mb-1 block text-sm font-medium text-gray-700'>
                    창 너비 (px)
                  </label>
                  <input
                    type='number'
                    value={project.settings.windowWidth}
                    onChange={(e) =>
                      handleSettingsChange(
                        'windowWidth',
                        parseInt(e.target.value)
                      )
                    }
                    className='w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500'
                    min='800'
                  />
                </div>
                <div>
                  <label className='mb-1 block text-sm font-medium text-gray-700'>
                    창 높이 (px)
                  </label>
                  <input
                    type='number'
                    value={project.settings.windowHeight}
                    onChange={(e) =>
                      handleSettingsChange(
                        'windowHeight',
                        parseInt(e.target.value)
                      )
                    }
                    className='w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500'
                    min='600'
                  />
                </div>
              </div>
            )}

            <div>
              <label className='mb-1 block text-sm font-medium text-gray-700'>
                종료 키 (선택사항)
              </label>
              <select
                value={project.settings.exitKey || ''}
                onChange={(e) =>
                  handleSettingsChange('exitKey', e.target.value || undefined)
                }
                className='w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>없음 (Alt+F4로만 종료)</option>
                <option value='Escape'>ESC</option>
                <option value='F11'>F11</option>
                <option value='F12'>F12</option>
              </select>
            </div>
          </div>
        </section>

        {/* UI 설정 */}
        <section className='border-t border-gray-200 pt-6'>
          <h3 className='mb-4 text-lg font-semibold text-gray-800'>UI 옵션</h3>

          <div className='space-y-3'>
            <label className='flex cursor-pointer items-center'>
              <input
                type='checkbox'
                checked={project.settings.showProgress}
                onChange={(e) =>
                  handleSettingsChange('showProgress', e.target.checked)
                }
                className='h-4 w-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500'
              />
              <span className='ml-2 text-sm text-gray-700'>
                진행 상황 표시 (예: "3/10 페이지")
              </span>
            </label>

            <label className='flex cursor-pointer items-center'>
              <input
                type='checkbox'
                checked={project.settings.showHomeButton}
                onChange={(e) =>
                  handleSettingsChange('showHomeButton', e.target.checked)
                }
                className='h-4 w-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500'
              />
              <span className='ml-2 text-sm text-gray-700'>
                홈 버튼 표시 (첫 페이지로 이동)
              </span>
            </label>

            <label className='flex cursor-pointer items-center'>
              <input
                type='checkbox'
                checked={project.settings.showBackButton}
                onChange={(e) =>
                  handleSettingsChange('showBackButton', e.target.checked)
                }
                className='h-4 w-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500'
              />
              <span className='ml-2 text-sm text-gray-700'>이전 버튼 표시</span>
            </label>

            <label className='flex cursor-pointer items-center'>
              <input
                type='checkbox'
                checked={project.settings.loopAtEnd}
                onChange={(e) =>
                  handleSettingsChange('loopAtEnd', e.target.checked)
                }
                className='h-4 w-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500'
              />
              <span className='ml-2 text-sm text-gray-700'>
                마지막 페이지 후 첫 페이지로 순환
              </span>
            </label>
          </div>
        </section>
      </div>
    </div>
  )
}

export default ProjectSettings
