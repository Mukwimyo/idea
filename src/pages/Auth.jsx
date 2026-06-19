import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    setLoading(true)
    setMessage('')
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('가입 완료! 로그인해주세요.')
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
      }}>
      <div
        style={{
          background: '#2d2157',
          borderRadius: 20,
          padding: '32px 28px',
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>✦</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>이데아</div>
          <div style={{ fontSize: 12, color: '#8b84c4', marginTop: 3 }}>역극 플랫폼</div>
        </div>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{
            background: '#1a1a2e',
            border: '0.5px solid #3d3580',
            borderRadius: 10,
            padding: '10px 13px',
            color: '#fff',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={{
            background: '#1a1a2e',
            border: '0.5px solid #3d3580',
            borderRadius: 10,
            padding: '10px 13px',
            color: '#fff',
            fontSize: 13,
            outline: 'none',
          }}
        />
        {message && <div style={{ fontSize: 12, color: '#c9b8e8', textAlign: 'center' }}>{message}</div>}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            background: '#7F77DD',
            border: 'none',
            borderRadius: 10,
            padding: '11px',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}>
          {loading ? '...' : isLogin ? '로그인' : '회원가입'}
        </button>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#8b84c4', cursor: 'pointer' }} onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? '계정이 없어요 → 회원가입' : '이미 계정이 있어요 → 로그인'}
        </div>
      </div>
    </div>
  )
}
