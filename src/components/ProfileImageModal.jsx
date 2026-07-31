import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export default function ProfileImageModal({ profile, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const swipeStartXRef = useRef(null)
  const urls = profile?.urls?.length ? profile.urls : profile?.url ? [profile.url] : []

  useEffect(() => {
    if (!profile) return
    setCurrentIndex(Math.max(0, Math.min(profile.index || 0, urls.length - 1)))
  }, [profile])

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
      <div
        onClick={event => event.stopPropagation()}
        onPointerDown={event => {
          swipeStartXRef.current = event.clientX
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }}
        onPointerUp={event => {
          if (swipeStartXRef.current === null) return
          const distance = event.clientX - swipeStartXRef.current
          swipeStartXRef.current = null
          if (distance < -45) setCurrentIndex(index => Math.min(urls.length - 1, index + 1))
          if (distance > 45) setCurrentIndex(index => Math.max(0, index - 1))
          event.currentTarget.releasePointerCapture?.(event.pointerId)
        }}
        onPointerCancel={() => {
          swipeStartXRef.current = null
        }}
        style={{ width: '100%', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'pan-y' }}>
        <img
          src={urls[currentIndex]}
          alt={`${profile.name || '이미지'} ${currentIndex + 1}`}
          draggable={false}
          style={{ display: 'block', maxWidth: 'min(88vw, 640px)', maxHeight: '78dvh', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.45)', userSelect: 'none' }}
        />
      </div>
      {urls.length > 1 && (
        <>
          <button onClick={event => { event.stopPropagation(); setCurrentIndex(index => Math.max(0, index - 1)) }} disabled={currentIndex === 0} aria-label="이전 이미지" style={{ position: 'absolute', left: 14, top: '50%', width: 38, height: 38, display: 'grid', placeItems: 'center', border: 0, borderRadius: '50%', color: '#fff', background: 'rgba(0,0,0,0.28)' }}><ChevronLeft size={23} /></button>
          <button onClick={event => { event.stopPropagation(); setCurrentIndex(index => Math.min(urls.length - 1, index + 1)) }} disabled={currentIndex === urls.length - 1} aria-label="다음 이미지" style={{ position: 'absolute', right: 14, top: '50%', width: 38, height: 38, display: 'grid', placeItems: 'center', border: 0, borderRadius: '50%', color: '#fff', background: 'rgba(0,0,0,0.28)' }}><ChevronRight size={23} /></button>
          <div style={{ position: 'absolute', bottom: 'max(18px, env(safe-area-inset-bottom))', padding: '5px 10px', borderRadius: 12, color: '#fff', background: 'rgba(0,0,0,0.3)', fontSize: 11 }}>{currentIndex + 1} / {urls.length}</div>
        </>
      )}
      {profile.name && <div style={{ marginTop: 14, color: '#fff', fontSize: 14, textAlign: 'center' }}>{profile.name}</div>}
    </div>
  )
}
