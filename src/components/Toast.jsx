export default function Toast({ toast }) {
  if (!toast) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="app-toast"
      data-error={toast.type === 'error'}>
      {toast.message}
    </div>
  )
}
