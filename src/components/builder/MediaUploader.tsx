import React, { useState } from 'react'
import { saveMediaFile } from '../../utils/mediaStorage'

type MediaUploaderProps = {
  onMediaUploaded: (mediaId: string, mediaType: 'video' | 'image') => void
}

const MediaUploader: React.FC<MediaUploaderProps> = ({ onMediaUploaded }) => {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // 파일 타입 확인
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')

      if (!isVideo && !isImage) {
        alert('비디오 또는 이미지 파일만 업로드할 수 있습니다.')
        setIsUploading(false)
        return
      }

      // 진행률 시뮬레이션 (실제로는 IndexedDB 저장이 매우 빠름)
      setUploadProgress(30)

      const mediaId = await saveMediaFile(file, isVideo ? 'video' : 'image')

      setUploadProgress(100)

      // 업로드 완료 콜백
      onMediaUploaded(mediaId, isVideo ? 'video' : 'image')

      // UI 리셋
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
      }, 500)
    } catch (error) {
      console.error('Failed to upload media:', error)
      alert('미디어 업로드에 실패했습니다.')
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      <h3 className='mb-4 text-lg font-semibold'>미디어 업로드</h3>

      {isUploading ? (
        <div className='py-8 text-center'>
          <div className='mb-4'>
            <div className='h-2 w-full rounded-full bg-gray-200'>
              <div
                className='h-2 rounded-full bg-blue-600 transition-all duration-300'
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
          <p className='text-sm text-gray-600'>
            업로드 중... {uploadProgress}%
          </p>
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
          </div>
        </div>
      )}
    </div>
  )
}

export default MediaUploader
