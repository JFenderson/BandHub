export default function Loading() {
  return (
    <div
      className="min-h-[60vh] flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
    >
      <div className="text-center">
        <div
          className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"
          aria-hidden="true"
        />
        <p className="text-gray-600">Loading...</p>
        <span className="sr-only">Please wait while the page loads</span>
      </div>
    </div>
  );
}