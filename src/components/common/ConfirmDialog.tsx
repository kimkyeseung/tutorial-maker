import React from 'react'

type ConfirmDialogProps = {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'warning' | 'info'
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onCancel,
  variant = 'danger',
}) => {
  if (!isOpen) return null

  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : variant === 'warning'
        ? 'bg-yellow-600 hover:bg-yellow-700'
        : 'bg-blue-600 hover:bg-blue-700'

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
      <div className='mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl'>
        <h3 className='mb-2 text-lg font-bold text-gray-900'>{title}</h3>
        <p className='mb-6 whitespace-pre-line text-gray-600'>{message}</p>
        <div className='flex justify-end gap-3'>
          <button
            onClick={onCancel}
            className='rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50'
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-white ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
