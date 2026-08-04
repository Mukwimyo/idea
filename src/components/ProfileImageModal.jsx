import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export default function ProfileImageModal({ profile, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const swipeStartXRef = useRef(null)
  const swipeStartTimeRef = useRef(0)
  const urls = profile?.urls?.length ? profile.urls : profile?.url ? [profile.url] : []

  useEffect(() => {
    if (!profile) return
    setCurrentIndex(Math.max(0, Math.min(profile.index || 0, urls.length - 1)))
    setDragOffset(0)
    setIsDragging(false)
  }, [profile])

  const moveTo = nextIndex => {
    setIsDragging(false)
    setDragOffset(0)
    setCurrentIndex(Math.max(0, Math.min(urls.length - 1, nextIndex)))
  }

  const finishSwipe = clientX => {
    if (swipeStartXRef.current === null) return
    const distance = clientX - swipeStartXRef.current
    const elapsed = Math.max(1, Date.now() - swipeStartTimeRef.current)
    const velocity = Math.abs(distance) / elapsed
    swipeStartXRef.current = null
    setIsDragging(false)

    const shouldMove = Math.abs(distance) > 55 || (Math.abs(distance) > 20 && velocity > 0.45)
    if (shouldMove && distance < 0 && currentIndex < urls.length - 1) {
      moveTo(currentIndex + 1)
    } else if (shouldMove && distance > 0 && currentIndex > 0) {
      moveTo(currentIndex - 1)
    } else {
      setDragOffset(0)
    }
  }

  useEffect(() => {
    if (!profile) return undefined
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [profile, onClose])

  if (!profile) return null
  const currentItem = profile.items?.[currentIndex]
  const uploadedAt = currentItem?.createdAt
    ? new Date(currentItem.createdAt).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''

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
      {currentItem && (
        <div onClick={event => event.stopPropagation()} style={{ position: 'absolute', top: 'max(22px, env(safe-area-inset-top))', left: 68, right: 24, color: '#fff', pointerEvents: 'none' }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{currentItem.uploader}</div>
          <div style={{ marginTop: 2, fontSize: 10, opacity: 0.68 }}>{uploadedAt}</div>
        </div>
      )}
      <div
        onClick={event => event.stopPropagation()}
        onPointerDown={event => {
          swipeStartXRef.current = event.clientX
          swipeStartTimeRef.current = Date.now()
          setIsDragging(true)
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }}
        onPointerMove={event => {
          if (swipeStartXRef.current === null) return
          let nextOffset = event.clientX - swipeStartXRef.current
          if ((currentIndex === 0 && nextOffset > 0) || (currentIndex === urls.length - 1 && nextOffset < 0)) nextOffset *= 0.28
          setDragOffset(nextOffset)
        }}
        onPointerUp={event => {
          finishSwipe(event.clientX)
          event.currentTarget.releasePointerCapture?.(event.pointerId)
        }}
        onPointerCancel={() => {
          swipeStartXRef.current = null
          setIsDragging(false)
          setDragOffset(0)
        }}
        style={{ width: '100vw', maxWidth: '100vw', minHeight: 0, overflow: 'hidden', clipPath: 'inset(0)', overscrollBehavior: 'none', touchAction: 'pan-y', cursor: isDragging ? 'grabbing' : 'grab' }}>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', transform: `translate3d(calc(${-currentIndex * 100}% + ${dragOffset}px), 0, 0)`, transition: isDragging ? 'none' : 'transform 280ms cubic-bezier(0.22, 0.72, 0, 1)', willChange: 'transform', backfaceVisibility: 'hidden' }}>
          {urls.map((url, index) => (
            <div key={`${url}-${index}`} style={{ flex: '0 0 100%', minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6vw', boxSizing: 'border-box', opacity: isDragging || index === currentIndex ? 1 : 0 }}>
              <img
                src={url}
                alt={`${profile.name || '이미지'} ${index + 1}`}
                draggable={false}
                style={{ display: 'block', maxWidth: 'min(88vw, 640px)', maxHeight: '78dvh', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.45)', userSelect: 'none' }}
              />
            </div>
          ))}
        </div>
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
