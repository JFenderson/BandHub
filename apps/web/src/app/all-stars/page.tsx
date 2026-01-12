import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'All-Star Bands | HBCU Band Hub',
  description: 'Explore summer all-star marching bands from cities across the nation. Watch battles, entrances, and performances from elite regional ensembles.',
};

async function getAllStarBands() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bands/all-stars`, {
      cache: 'no-store',
    });
    
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.error('Failed to fetch all-star bands:', error);
    return [];
  }
}

export default async function AllStarBandsPage() {
  const bands = await getAllStarBands();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          All-Star Bands
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl">
          During the summer months when school is out, elite musicians from various HBCU programs 
          come together to form regional all-star bands. These summer ensembles represent their 
          cities in battles and showcases from May through August.
        </p>
      </section>

      {/* Band Grid */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bands.map((band: any) => (
            <Link
              key={band.id}
              href={`/bands/${band.slug}`}
              className="group bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden"
            >
              <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 relative">
                {band.logoUrl ? (
                  <Image
                    src={band.logoUrl}
                    alt={band.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-white font-bold text-2xl">
                    {band.name.charAt(0)}
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600 transition-colors">
                  {band.name}
                </h3>
                
                {band.city && band.state && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    📍 {band.city}, {band.state}
                  </p>
                )}
                
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
                  {band.description}
                </p>
                
                <div className="flex items-center text-sm text-gray-500">
                  <span>{band._count.videos} videos</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Educational Section */}
      <section className="mt-16 bg-gray-50 dark:bg-gray-800 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-4">About All-Star Bands</h2>
        <div className="prose dark:prose-invert max-w-none">
          <p>
            All-star bands emerged around 2011 as a way for talented musicians to continue 
            performing during the summer break. These bands typically operate from May through 
            August, with most major events happening in June and July.
          </p>
          <p>
            Unlike school bands, all-star bands are community-driven and volunteer-based. 
            They represent regional pride, with fans supporting their city's ensemble. 
            Battles between all-star bands (like GAMB vs. Memphis All-Stars) are highly 
            anticipated summer events.
          </p>
        </div>
      </section>
    </div>
  );
}