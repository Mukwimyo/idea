import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setMessage('이메일과 비밀번호를 입력해 주세요.')
      return
    }

    setLoading(true)
    setMessage('')
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('가입이 완료되었습니다. 로그인해 주세요.')
    }
    setLoading(false)
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'radial-gradient(circle at 50% 18%, #30265d 0%, #1a1a2e 44%, #121220 100%)',
        '--focus-color': '#afa9ec',
      }}>
      <section
        aria-labelledby="auth-title"
        style={{
          background: 'color-mix(in srgb, #2d2157 88%, transparent)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid #51479a',
          boxShadow: '0 24px 70px rgba(5, 5, 20, 0.38)',
          borderRadius: 22,
          padding: '34px 28px 28px',
          width: '100%',
          maxWidth: 340,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
        <header style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ color: '#aaa5d8', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', marginBottom: 10 }}>ROLEPLAY MESSENGER</div>
          <div aria-hidden="true" style={{ width: 34, height: 3, margin: '0 auto 12px', borderRadius: 2, background: '#7f77dd', transform: 'skewX(-24deg)' }} />
          <h1 id="auth-title" style={{ fontSize: 25, lineHeight: 1.15, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>이데아</h1>
          <div style={{ marginTop: 5, color: '#aaa5d8', fontSize: 12 }}>캐릭터로 이어지는 이야기</div>
        </header>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: '#c9c5e8', fontSize: 12 }}>이메일</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            style={{ minHeight: 44, background: '#171728', border: '1px solid #51479a', borderRadius: 11, padding: '10px 13px', color: '#fff', fontSize: 14 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: '#c9c5e8', fontSize: 12 }}>비밀번호</span>
          <input
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={event => setPassword(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && handleSubmit()}
            style={{ minHeight: 44, background: '#171728', border: '1px solid #51479a', borderRadius: 11, padding: '10px 13px', color: '#fff', fontSize: 14 }}
          />
        </label>

        {message && <div role="status" style={{ fontSize: 12, lineHeight: 1.5, color: '#d6d2f0', textAlign: 'center' }}>{message}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ minHeight: 46, marginTop: 2, background: '#7f77dd', border: '1px solid #afa9ec', borderRadius: 11, padding: '11px 14px', color: '#fff', fontSize: 14, fontWeight: 650, cursor: 'pointer' }}>
          {loading ? '처리 중…' : isLogin ? '로그인' : '회원가입'}
        </button>
        <button
          onClick={() => {
            setIsLogin(current => !current)
            setMessage('')
          }}
          style={{ minHeight: 44, border: 0, background: 'none', color: '#aaa5d8', fontSize: 12, cursor: 'pointer' }}>
          {isLogin ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
        </button>
      </section>
    </main>
  )
}
