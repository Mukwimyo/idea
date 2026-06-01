import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import RoomList from './pages/RoomList'
import Room from './pages/Room'
import Characters from './pages/Characters'
import Settings from './pages/Settings'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#7F77DD', fontSize: 28 }}>✦</div>
    </div>
  )

  return (
    <BrowserRouter basename="/idea">
      <Routes>
        <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <RoomList /> : <Navigate to="/auth" />} />
        <Route path="/room/:roomId" element={session ? <Room /> : <Navigate to="/auth" />} />
        <Route path="/room/:roomId/characters" element={session ? <Characters /> : <Navigate to="/auth" />} />
        <Route path="/characters" element={session ? <Characters /> : <Navigate to="/auth" />} />
        <Route path="/settings" element={session ? <Settings /> : <Navigate to="/auth" />} />
      </Routes>
    </BrowserRouter>
  )
}