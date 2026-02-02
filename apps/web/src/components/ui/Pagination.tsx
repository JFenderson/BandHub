'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}

export function Pagination({ currentPage, totalPages, baseUrl }: PaginationProps) {
  const searchParams = useSearchParams();

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('page', page.toString());
    return `${baseUrl}?${params.toString()}`;
  };

  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const showEllipsis = totalPages > 7;

  if (showEllipsis) {
    // Show first page
    pages.push(1);

    // Show ellipsis or pages near current
    if (currentPage > 3) {
      pages.push(-1); // -1 represents ellipsis
    }

    // Show pages around current
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }

    // Show ellipsis or last pages
    if (currentPage < totalPages - 2) {
      pages.push(-2); // -2 represents second ellipsis
    }

    // Show last page
    pages.push(totalPages);
  } else {
    // Show all pages if total is 7 or less
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Previous Button */}
      {currentPage > 1 ? (
        <Link
          href={createPageUrl(currentPage - 1)}
          className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Previous
        </Link>
      ) : (
        <span className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed">
          Previous
        </span>
      )}

      {/* Page Numbers */}
      {pages.map((page, index) => {
        if (page < 0) {
          return (
            <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-400">
              ...
            </span>
          );
        }

        return (
          <Link
            key={page}
            href={createPageUrl(page)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              currentPage === page
                ? 'bg-primary-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {page}
          </Link>
        );
      })}

      {/* Next Button */}
      {currentPage < totalPages ? (
        <Link
          href={createPageUrl(currentPage + 1)}
          className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Next
        </Link>
      ) : (
        <span className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed">
          Next
        </span>
      )}
    </div>
  );
}