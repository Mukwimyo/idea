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
import LoadingScreen from './components/LoadingScreen'

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
        .select('font_id, font_scale, theme_id')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.font_id && FONT_MAP[data.font_id]) {
            document.body.style.fontFamily = FONT_MAP[data.font_id]
          }
          if (data?.theme_id) localStorage.setItem('idea-theme-id', data.theme_id)
          const fontScale = Number(data?.font_scale || localStorage.getItem('idea-font-scale') || 1)
          document.documentElement.style.setProperty('--idea-font-scale', String(fontScale))
          localStorage.setItem('idea-font-scale', String(fontScale))
        })
    })

    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined || !splashReady)
    return <LoadingScreen />

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
