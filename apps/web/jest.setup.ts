import '@testing-library/jest-dom';

// Mock Next.js navigation hooks for unit tests
jest.mock('next/navigation', () => {
  const actual = jest.requireActual('next/navigation');
  return {
    ...actual,
    useRouter: () => ({ push: jest.fn(), prefetch: jest.fn() }),
    useSearchParams: () => new URLSearchParams(),
  };
});
