export default function Custom500() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
        500 - Server Error
      </h1>
      <p style={{ marginTop: '1rem', color: '#666' }}>
        An unexpected error has occurred.
      </p>
      <a
        href="/"
        style={{
          marginTop: '1.5rem',
          color: '#dc2626',
          textDecoration: 'underline',
        }}
      >
        Go back home
      </a>
    </div>
  );
}
