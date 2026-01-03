import { Suspense } from 'react';
import { Metadata } from 'next';
import { AdvancedVideoSearch } from '@/components/search/AdvancedVideoSearch';
import { getPopularSearches } from '@/lib/api/search';
import { decodeSearchFromURL } from '@/lib/utils/searchParams';

export const metadata: Metadata = {
  title: 'Search HBCU Band Videos | HBCU Band Hub',
  description: 'Search and discover performances, battles, parades, and more from HBCU marching bands across the country.',
  openGraph: {
    title: 'Search HBCU Band Videos',
    description: 'Find your favorite HBCU band performances',
    type: 'website',
  },
};

interface SearchPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

async function SearchContent({ searchParams }: SearchPageProps) {
  // Fetch popular searches server-side
  let popularSearches = [];
  try {
    popularSearches = await getPopularSearches(10);
  } catch (error) {
    console.error('Failed to fetch popular searches:', error);
  }

  // Decode initial query from URL parameters
  const urlSearchParams = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(v => urlSearchParams.append(key, v));
      } else {
        urlSearchParams.append(key, value);
      }
    }
  });

  const initialQuery = decodeSearchFromURL(urlSearchParams);

  return (
    <AdvancedVideoSearch
      initialQuery={initialQuery}
      popularSearches={popularSearches}
      autoFocus={!initialQuery.q} // Only autofocus if no initial query
    />
  );
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 
                          border-solid border-blue-600 border-r-transparent mb-4"></div>
            <p className="text-gray-600">Loading search...</p>
          </div>
        </div>
      }
    >
      <SearchContent searchParams={searchParams} />
    </Suspense>
  );
}

// Enable dynamic rendering for search params
export const dynamic = 'force-dynamic';