import type { Metadata } from 'next';
import { apiClient } from '@/lib/api-client';
import { VideoPageContent } from '@/components/video/VideoPageContent';
import type { Video } from '@/types/api';

interface VideoPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: VideoPageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const video = await apiClient.getVideo(id);
    const bandName = video.band?.name;
    const title = bandName
      ? `${video.title} - ${bandName} | BandHub`
      : `${video.title} | BandHub`;

    return {
      title,
      description: video.description || `Watch ${video.title} on HBCU Band Hub`,
      openGraph: {
        title,
        description: video.description || `Watch ${video.title} on HBCU Band Hub`,
        images: video.thumbnailUrl ? [{ url: video.thumbnailUrl }] : undefined,
      },
    };
  } catch {
    return {
      title: 'Video | BandHub',
    };
  }
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { id } = await params;
  let video: Video | null = null;

  try {
    video = await apiClient.getVideo(id);
  } catch (error) {
    console.error('Failed to fetch video server-side:', error);
    // Don't call notFound() — let VideoPageContent re-fetch client-side
  }

  return <VideoPageContent id={id} initialVideo={video} />;
}