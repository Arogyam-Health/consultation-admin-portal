export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      color: '#e6edf3',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Manrope', system-ui, -apple-system, sans-serif",
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '12px',
        padding: '48px 40px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏥</div>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          marginBottom: '6px',
          color: '#FF5F15',
          fontFamily: "'Poppins', sans-serif"
        }}>
          The Obesity Killer
        </h1>
        <p style={{ color: '#8b949e', fontSize: '0.88rem', marginBottom: '32px' }}>
          Shopify consultative weight-loss assessment & scheduler backend.
        </p>

        <a href="/admin" style={{
          display: 'block',
          padding: '14px 24px',
          borderRadius: '8px',
          background: '#FF5F15',
          color: 'white',
          fontWeight: '600',
          fontSize: '0.95rem',
          textDecoration: 'none',
          transition: 'background 0.2s',
        }}>
          Open Admin Portal
        </a>

        <div style={{
          marginTop: '32px',
          color: '#484f58',
          fontSize: '0.75rem',
          borderTop: '1px solid #21262d',
          paddingTop: '16px'
        }}>
          Obesity Assessment Platform
        </div>
      </div>
    </div>
  );
}
