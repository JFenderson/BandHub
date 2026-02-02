export default function Custom404() {
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
        404 - Page Not Found
      </h1>
      <p style={{ marginTop: '1rem', color: '#666' }}>
        The page you are looking for could not be found.
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
