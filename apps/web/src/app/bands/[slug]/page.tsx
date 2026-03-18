import type { Metadata } from 'next';
import { apiClient } from '@/lib/api-client';
import { BandPageContent } from '@/components/bands/BandPageContent';
import type { Band, Video } from '@/types/api';

interface BandPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: BandPageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const band = await apiClient.getBand(slug);
    const location = band.city && band.state ? ` from ${band.city}, ${band.state}` : '';
    const title = `${band.name} - Videos | BandHub`;
    const description = band.description || `Watch videos of ${band.name} marching band${location} on HBCU Band Hub`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: band.logoUrl ? [{ url: band.logoUrl }] : undefined,
      },
    };
  } catch {
    return {
      title: 'Band | BandHub',
    };
  }
}

export default async function BandPage({ params }: BandPageProps) {
  const { slug } = await params;
  let band: Band | null = null;
  let videos: Video[] = [];
  let totalVideos = 0;

  try {
    band = await apiClient.getBand(slug);
    const videosResult = await apiClient.getVideos({
      bandId: band.id,
      page: 1,
      limit: 12,
      sortBy: 'publishedAt',
      sortOrder: 'desc',
    });
    videos = videosResult.data;
    totalVideos = videosResult.meta.total;
  } catch (error) {
    console.error('Failed to fetch band data server-side:', error);
    // Don't call notFound() — let BandPageContent re-fetch client-side
  }

  return (
    <BandPageContent
      slug={slug}
      initialBand={band}
      initialVideos={videos}
      initialTotal={totalVideos}
    />
  );
}
