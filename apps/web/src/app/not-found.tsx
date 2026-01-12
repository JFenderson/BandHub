import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
      <p className="mt-4 text-gray-600">
        The page you're looking for doesn't exist.
      </p>
      <a href="/" className="mt-6 text-blue-600 hover:underline">
        Go back home
      </a>
    </div>
  );
}