import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const validateImageFile = file => {
  if (!file) return '이미지 파일을 선택해 주세요.'
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다.'
  if (file.size > MAX_IMAGE_SIZE) return '이미지는 5MB 이하만 업로드할 수 있습니다.'
  return null
}

export const uploadFile = async (file, path) => {
  if (validateImageFile(file)) return null
  const { error } = await supabase.storage.from('idea-uploads').upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) return null
  const {
    data: { publicUrl },
  } = supabase.storage.from('idea-uploads').getPublicUrl(path)
  return publicUrl
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export const subscribePush = async userId => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('push unsupported')
    return { success: false, reason: 'unsupported' }
  }

  const permission = await Notification.requestPermission()
  console.log('permission:', permission)
  if (permission !== 'granted') {
    return { success: false, reason: 'denied' }
  }

  let registration
  try {
    registration = await navigator.serviceWorker.register('/idea/sw.js')
    console.log('sw registered:', registration)
  } catch (err) {
    console.error('sw register error:', err)
    return { success: false, reason: 'sw_register_failed' }
  }
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    })
  }

  const subJson = subscription.toJSON()
  const { error: cleanupError } = await supabase.from('push_subscriptions').delete().eq('endpoint', subJson.endpoint).neq('user_id', userId)
  if (cleanupError) {
    console.warn('stale push subscription cleanup skipped:', cleanupError.message)
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
    },
    { onConflict: 'user_id,endpoint' }
  )

  if (error) return { success: false, reason: 'db_error' }
  return { success: true }
}

export const unsubscribePush = async userId => {
  const registration = await navigator.serviceWorker.getRegistration('/idea/sw.js')
  if (registration) {
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint).eq('user_id', userId)
      await subscription.unsubscribe()
    }
  }
}
