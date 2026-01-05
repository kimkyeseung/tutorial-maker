import React, { useState } from 'react'

import { saveMediaFile } from '../../utils/mediaStorage'
import {
  canCompress,
  compressVideo,
  CompressionProgress,
  analyzeVideo,
} from '../../utils/videoCompressor'

type MediaUploaderProps = {
  onMediaUploaded: (mediaId: string, mediaType: 'video' | 'image') => void
  /** 압축 활성화 여부 (기본값: true) */
  enableCompression?: boolean
}

type UploadStage = 'idle' | 'analyzing' | 'compressing' | 'saving' | 'done'

const MediaUploader: React.FC<MediaUploaderProps> = ({
  onMediaUploaded,
  enableCompression = true,
}) => {
  const [stage, setStage] = useState<UploadStage>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number
    compressedSize?: number
    stage?: CompressionProgress['stage']
  } | null>(null)
  const [skipCompression, setSkipCompression] = useState(false)

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStage('analyzing')
    setUploadProgress(0)
    setCompressionInfo({ originalSize: file.size })

    try {
      // 파일 타입 확인
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')

      if (!isVideo && !isImage) {
        alert('비디오 또는 이미지 파일만 업로드할 수 있습니다.')
        setStage('idle')
        return
      }

      let fileToSave: File | Blob = file
      const mediaType = isVideo ? 'video' : 'image'

      // 비디오 압축 처리
      if (
        isVideo &&
        enableCompression &&
        !skipCompression &&
        canCompress()
      ) {
        try {
          // 비디오 분석
          const metadata = await analyzeVideo(file)
          const needsCompressionCheck =
            metadata.width > 1080 ||
            metadata.height > 1080 ||
            metadata.estimatedBitrate > 2_500_000 // 2.5 Mbps 이상

          if (needsCompressionCheck) {
            setStage('compressing')

            const result = await compressVideo(
              file,
              {
                maxResolution: 1080,
                quality: 'medium',
              },
              (progress) => {
                setUploadProgress(progress.percent)
                setCompressionInfo((prev) => ({
                  ...prev!,
                  stage: progress.stage,
                }))
              }
            )

            if (result.compressionRatio > 0) {
              fileToSave = result.blob
              setCompressionInfo((prev) => ({
                ...prev!,
                compressedSize: result.compressedSize,
              }))
            }
          }
        } catch (compressionError) {
          console.warn('Video compression failed, using original:', compressionError)
          // 압축 실패 시 원본 사용
        }
      }

      // IndexedDB에 저장
      setStage('saving')
      setUploadProgress(90)

      const mediaId = await saveMediaFile(
        fileToSave instanceof File
          ? fileToSave
          : new File([fileToSave], file.name, { type: fileToSave.type || file.type }),
        mediaType
      )

      setUploadProgress(100)
      setStage('done')

      // 업로드 완료 콜백
      onMediaUploaded(mediaId, mediaType)

      // UI 리셋
      setTimeout(() => {
        setStage('idle')
        setUploadProgress(0)
        setCompressionInfo(null)
      }, 1000)
    } catch (error) {
      console.error('Failed to upload media:', error)
      alert('미디어 업로드에 실패했습니다.')
      setStage('idle')
      setUploadProgress(0)
      setCompressionInfo(null)
    }
  }

  const getStageText = (): string => {
    switch (stage) {
      case 'analyzing':
        return '분석 중...'
      case 'compressing':
        return `압축 중... ${uploadProgress}%`
      case 'saving':
        return '저장 중...'
      case 'done':
        return '완료!'
      default:
        return ''
    }
  }

  const isProcessing = stage !== 'idle'

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>미디어 업로드</h3>
        {enableCompression && canCompress() && (
          <label className='flex cursor-pointer items-center gap-2 text-sm'>
            <input
              type='checkbox'
              checked={!skipCompression}
              onChange={(e) => setSkipCompression(!e.target.checked)}
              className='h-4 w-4 rounded border-gray-300'
              disabled={isProcessing}
            />
            <span className='text-gray-600'>영상 자동 압축</span>
          </label>
        )}
      </div>

      {isProcessing ? (
        <div className='py-8 text-center'>
          <div className='mb-4'>
            <div className='h-2 w-full rounded-full bg-gray-200'>
              <div
                className='h-2 rounded-full bg-blue-600 transition-all duration-300'
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
          <p className='text-sm font-medium text-gray-700'>{getStageText()}</p>

          {compressionInfo && stage === 'compressing' && (
            <div className='mt-3 text-xs text-gray-500'>
              <p>원본 크기: {formatFileSize(compressionInfo.originalSize)}</p>
              {compressionInfo.compressedSize && (
                <p className='text-green-600'>
                  압축 후: {formatFileSize(compressionInfo.compressedSize)}
                  {' ('}
                  {Math.round(
                    (1 - compressionInfo.compressedSize / compressionInfo.originalSize) * 100
                  )}
                  % 감소)
                </p>
              )}
            </div>
          )}

          {stage === 'done' && compressionInfo?.compressedSize && (
            <div className='mt-3 text-xs text-green-600'>
              ✓ {formatFileSize(compressionInfo.originalSize)} →{' '}
              {formatFileSize(compressionInfo.compressedSize)}
              {' ('}
              {Math.round(
                (1 - compressionInfo.compressedSize / compressionInfo.originalSize) * 100
              )}
              % 절약)
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className='block cursor-pointer'>
            <div className='rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-500 hover:bg-blue-50'>
              <div className='mb-2 text-4xl'>📁</div>
              <p className='mb-1 font-medium text-gray-700'>
                클릭하여 파일 선택
              </p>
              <p className='text-sm text-gray-500'>
                MP4, WebM 영상 또는 PNG, JPG 이미지
              </p>
            </div>
            <input
              type='file'
              accept='video/mp4,video/webm,image/png,image/jpeg,image/jpg'
              onChange={handleFileUpload}
              className='hidden'
            />
          </label>

          <div className='mt-4 text-xs text-gray-500'>
            <p>• 권장: 1920x1080 해상도</p>
            <p>• 영상은 MP4 또는 WebM 형식</p>
            <p>• 이미지는 PNG 또는 JPG 형식</p>
            {enableCompression && !skipCompression && canCompress() && (
              <p className='mt-1 text-blue-600'>
                • 대용량 영상은 자동으로 압축됩니다
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MediaUploader
