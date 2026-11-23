import { useRef } from 'react'
import { Button, Dialog } from './ui'

export default function ConfirmDialog({
  open, title, description, confirmLabel = '확인', cancelLabel = '취소', danger = false, onConfirm, onCancel,
}) {
  const confirmRef = useRef(null)

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      role="alertdialog"
      initialFocusRef={confirmRef}
      onCancel={onCancel}>
      <div className="ui-dialog-actions">
        <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
        <Button ref={confirmRef} variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  )
}
