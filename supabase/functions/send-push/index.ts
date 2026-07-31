import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')

webpush.setVapidDetails('mailto:admin@example.com', vapidPublicKey, vapidPrivateKey)

Deno.serve(async req => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method not allowed' }), {
        status: 405,
        headers: { Allow: 'POST', 'Content-Type': 'application/json' },
      })
    }

    if (!webhookSecret) {
      console.error('PUSH_WEBHOOK_SECRET is not configured')
      return new Response(JSON.stringify({ error: 'server misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (req.headers.get('x-webhook-secret') !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    const record = payload.record

    if (payload.type && payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'event ignored' }), { status: 200 })
    }

    if (!record || !record.room_id || !record.user_id) {
      return new Response(JSON.stringify({ error: 'invalid payload' }), { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 같은 방의 다른 멤버 찾기
    const { data: members } = await supabase.from('room_members').select('user_id').eq('room_id', record.room_id).neq('user_id', record.user_id)

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ message: 'no recipients' }), { status: 200 })
    }

    const recipientIds = members.map(m => m.user_id)

    // 수신자들의 구독 정보 가져오기
    const [{ data: recipientSubs, error: recipientSubsError }, { data: senderSubs, error: senderSubsError }] = await Promise.all([
      supabase.from('push_subscriptions').select('*').in('user_id', recipientIds),
      supabase.from('push_subscriptions').select('endpoint').eq('user_id', record.user_id),
    ])

    if (recipientSubsError || senderSubsError) {
      console.error('push subscription lookup failed', recipientSubsError || senderSubsError)
      return new Response(JSON.stringify({ error: 'subscription lookup failed' }), { status: 500 })
    }

    const senderEndpoints = new Set((senderSubs || []).map(sub => sub.endpoint))
    const seenEndpoints = new Set<string>()
    const subs = (recipientSubs || []).filter(sub => {
      if (senderEndpoints.has(sub.endpoint) || seenEndpoints.has(sub.endpoint)) return false
      seenEndpoints.add(sub.endpoint)
      return true
    })

    if (subs.length === 0) {
      return new Response(JSON.stringify({ message: 'no subscriptions' }), { status: 200 })
    }

    // 발신자 캐릭터 이름 가져오기
    let senderName = '새 메시지'
    if (record.character_id) {
      const { data: char } = await supabase.from('characters').select('name').eq('id', record.character_id).single()
      if (char) senderName = char.name
    }

    let bodyText = record.type === 'image' || record.type === 'image_group' ? '사진을 보냈어요' : record.type === 'narration' ? record.content : record.content
    if (record.type === 'communication') {
      try {
        const communication = JSON.parse(record.content)
        bodyText = `${communication.title} · ${communication.statusLabel}`
      } catch {
        bodyText = '전화·문자 기록이 도착했습니다.'
      }
    }

    const notifPayload = JSON.stringify({
      title: senderName,
      body: bodyText?.slice(0, 50) || '',
      url: `/idea/room/${record.room_id}`,
    })

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notifPayload
        )
      )
    )

    // 실패한 구독(만료 등) 정리
    results.forEach((r, i) => {
      if (r.status === 'rejected' && (r.reason?.statusCode === 410 || r.reason?.statusCode === 404)) {
        supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subs[i].endpoint)
          .then(() => {})
      }
    })

    return new Response(JSON.stringify({ sent: results.length }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
