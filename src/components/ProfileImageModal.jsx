import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function ProfileImageModal({ profile, onClose }) {
  useEffect(() => {
    if (!profile) return undefined
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [profile, onClose])

  if (!profile) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.name || '프로필'} 사진`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.86)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <button
        onClick={onClose}
        aria-label="닫기"
        style={{ position: 'absolute', top: 'max(18px, env(safe-area-inset-top))', left: 18, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <X size={22} />
      </button>
      <img
        src={profile.url}
        alt={`${profile.name || '프로필'} 사진`}
        onClick={event => event.stopPropagation()}
        style={{ display: 'block', maxWidth: 'min(88vw, 640px)', maxHeight: '78dvh', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.45)' }}
      />
      {profile.name && <div style={{ marginTop: 14, color: '#fff', fontSize: 14, textAlign: 'center' }}>{profile.name}</div>}
    </div>
  )
}
