import { getTheme } from '../lib/themes'

export default function LoadingScreen({ theme }) {
  const resolvedTheme = theme || getTheme(localStorage.getItem('idea-theme-id') || 'dark-purple')
  const logoVariant = resolvedTheme.dark ? 'dark' : 'light'
  const logo = `${import.meta.env.BASE_URL}branding/idea-logo-launch-${logoVariant}.png`

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: resolvedTheme.bg,
        transition: 'background 180ms ease',
      }}>
      <div aria-hidden="true" style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: resolvedTheme.point, opacity: resolvedTheme.dark ? 0.09 : 0.06, filter: 'blur(70px)' }} />
      <img
        className="idea-loading-logo"
        src={logo}
        alt="IDEA"
        style={{ position: 'relative', width: 'min(58vw, 260px)', height: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}
