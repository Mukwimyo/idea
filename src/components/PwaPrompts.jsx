import { useEffect, useState } from 'react'
import { Download, RefreshCw, WifiOff, X } from 'lucide-react'

export default function PwaPrompts() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [updateRegistration, setUpdateRegistration] = useState(null)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const handleInstall = event => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('beforeinstallprompt', handleInstall)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => {
        registration.update()
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdateRegistration(registration)
          })
        })
      })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstall)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const install = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const update = () => {
    if (!updateRegistration?.waiting) return
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
    updateRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  if (!online)
    return (
      <div className="app-status-banner app-status-banner--offline" role="status">
        <WifiOff size={16} />
        <span>오프라인 상태예요. 메시지는 연결이 복구되면 다시 전송됩니다.</span>
      </div>
    )

  if (updateRegistration)
    return (
      <div className="app-status-banner" role="status">
        <RefreshCw size={16} />
        <span>새 버전을 사용할 수 있어요.</span>
        <button onClick={update}>업데이트</button>
        <button aria-label="닫기" onClick={() => setUpdateRegistration(null)}><X size={15} /></button>
      </div>
    )

  if (installPrompt)
    return (
      <div className="app-status-banner" role="status">
        <Download size={16} />
        <span>IDEA를 앱으로 설치할 수 있어요.</span>
        <button onClick={install}>설치</button>
        <button aria-label="닫기" onClick={() => setInstallPrompt(null)}><X size={15} /></button>
      </div>
    )

  return null
}
