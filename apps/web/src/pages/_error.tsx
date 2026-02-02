import { NextPageContext } from 'next';

interface ErrorProps {
  statusCode: number;
}

function Error({ statusCode }: ErrorProps) {
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
        {statusCode ? `Error ${statusCode}` : 'An error occurred'}
      </h1>
      <p style={{ marginTop: '1rem', color: '#666' }}>
        {statusCode === 404
          ? 'The page you are looking for could not be found.'
          : 'An unexpected error has occurred.'}
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

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
