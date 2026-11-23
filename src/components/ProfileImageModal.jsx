import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Settings, X } from 'lucide-react'
import { Button, IconButton } from './ui'

export default function ProfileImageModal({ profile, onClose, onEdit }) {
  if (!profile) return null
  const urls = profile.urls?.length ? profile.urls : profile.url ? [profile.url] : []
  const modalKey = `${urls.join('|')}::${profile.index || 0}`
  return <ProfileImageViewer key={modalKey} profile={profile} urls={urls} onClose={onClose} onEdit={onEdit} />
}

function ProfileImageViewer({ profile, urls, onClose, onEdit }) {
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, Math.min(profile.index || 0, urls.length - 1)))
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const swipeStartXRef = useRef(null)
  const swipeStartTimeRef = useRef(0)

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
      className="profile-image-viewer">
      <IconButton
        type="button"
        onClick={onClose}
        label="닫기"
        className="profile-image-viewer__control profile-image-viewer__close">
        <X size={22} />
      </IconButton>
      {currentItem && (
        <div onClick={event => event.stopPropagation()} className="profile-image-viewer__metadata">
          <div>{currentItem.uploader}</div>
          <small>{uploadedAt}</small>
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
        className="profile-image-viewer__viewport"
        data-dragging={isDragging}>
        <div className="profile-image-viewer__track" style={{ transform: `translate3d(calc(${-currentIndex * 100}% + ${dragOffset}px), 0, 0)` }}>
          {urls.map((url, index) => (
            <div key={`${url}-${index}`} className="profile-image-viewer__slide" data-visible={isDragging || index === currentIndex}>
              <img
                src={url}
                alt={`${profile.name || '이미지'} ${index + 1}`}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
      {urls.length > 1 && (
        <>
          <IconButton type="button" className="profile-image-viewer__control profile-image-viewer__previous" onClick={event => { event.stopPropagation(); setCurrentIndex(index => Math.max(0, index - 1)) }} disabled={currentIndex === 0} label="이전 이미지"><ChevronLeft size={23} /></IconButton>
          <IconButton type="button" className="profile-image-viewer__control profile-image-viewer__next" onClick={event => { event.stopPropagation(); setCurrentIndex(index => Math.min(urls.length - 1, index + 1)) }} disabled={currentIndex === urls.length - 1} label="다음 이미지"><ChevronRight size={23} /></IconButton>
          <div className="profile-image-viewer__count">{currentIndex + 1} / {urls.length}</div>
        </>
      )}
      {profile.name && <div className="profile-image-viewer__name">{profile.name}</div>}
      {onEdit && (
        <Button variant="ghost" className="profile-image-viewer__edit" onClick={event => { event.stopPropagation(); onEdit() }}>
          <Settings size={15} /> 프로필 수정
        </Button>
      )}
    </div>
  )
}
