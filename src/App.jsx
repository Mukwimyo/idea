import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import RoomList from './pages/RoomList'
import Room from './pages/Room'
import Characters from './pages/Characters'
import Settings from './pages/Settings'
import Help from './pages/Help'
import PwaPrompts from './components/PwaPrompts'

const FONT_MAP = {
  'godo-b': 'GodoB',
  'godo-m': 'GodoM',
  pretendard: 'Pretendard',
  'nanum-gothic': 'Nanum Gothic',
  'nanum-myeongjo': 'Nanum Myeongjo',
  'noto-serif': 'Noto Serif KR',
  'maru-buri': 'MaruBuri',
  'jeju-myeongjo': 'Jeju Myeongjo',
  aggro: 'SBAggroB',
}

const LAUNCH_LOGO = `${import.meta.env.BASE_URL}branding/idea-logo-launch-dark.png`

export default function App() {
  const [session, setSession] = useState(undefined)
  const [splashReady, setSplashReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashReady(true), 650)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('font_id, font_scale')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.font_id && FONT_MAP[data.font_id]) {
            document.body.style.fontFamily = FONT_MAP[data.font_id]
          }
          const fontScale = Number(data?.font_scale || localStorage.getItem('idea-font-scale') || 1)
          document.documentElement.style.setProperty('--idea-font-scale', String(fontScale))
          localStorage.setItem('idea-font-scale', String(fontScale))
        })
    })

    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined || !splashReady)
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <img
          className="app-launch-logo"
          src={LAUNCH_LOGO}
          alt="IDEA"
          style={{
            width: 'min(64vw, 300px)',
            height: 'auto',
            animation: 'app-logo-enter 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
          }}
        />
        <style>{`
          @keyframes app-logo-enter {
            from { opacity: 0; transform: translateY(8px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .app-launch-logo { animation: none !important; }
          }
        `}</style>
      </div>
    )

  return (
    <>
      <PwaPrompts />
      <BrowserRouter basename="/idea">
        <Routes>
          <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" />} />
          <Route path="/" element={session ? <RoomList /> : <Navigate to="/auth" />} />
          <Route path="/room/:roomId" element={session ? <Room /> : <Navigate to="/auth" />} />
          <Route path="/room/:roomId/characters" element={session ? <Characters /> : <Navigate to="/auth" />} />
          <Route path="/characters" element={session ? <Characters /> : <Navigate to="/auth" />} />
          <Route path="/settings" element={session ? <Settings /> : <Navigate to="/auth" />} />
          <Route path="/help" element={session ? <Help /> : <Navigate to="/auth" />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}
