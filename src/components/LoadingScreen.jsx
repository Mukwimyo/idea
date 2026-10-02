export default function LoadingScreen() {
  const logo = `${import.meta.env.BASE_URL}branding/idea-logo-launch-dark.png`

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
        background: '#000000',
      }}>
      <img
        className="idea-loading-logo"
        src={logo}
        alt="IDEA"
        style={{ position: 'relative', width: 'min(58vw, 260px)', height: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}
