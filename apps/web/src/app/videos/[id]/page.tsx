import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { BandLogo } from '@/components/images';
import { YouTubeEmbed } from '@/components/videos/YouTubeEmbed';
import { RelatedVideosSidebar } from '@/components/video/RelatedVideosSidebar';
import type { Video } from '@/types/api';
import { VIDEO_CATEGORY_LABELS } from '@hbcu-band-hub/shared-types';

interface VideoPageProps {
  params: {
    id: string;
  };
}

export default async function VideoPage({ params }: VideoPageProps) {
  let video: Video;

  try {
    video = await apiClient.getVideo(params.id);
  } catch (error) {
    notFound();
  }

  return (
    <div className="bg-white">
      <div className="container-custom py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <YouTubeEmbed videoId={video.youtubeId} title={video.title} />
            <div className="mt-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{video.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>{video.viewCount?.toLocaleString() || 0} views</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{format(new Date(video.publishedAt), 'MMM d, yyyy')}</span>
                </div>
                {video.category && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-100 text-primary-700 font-medium">
                    {VIDEO_CATEGORY_LABELS[video.category]}
                  </span>
                )}
              </div>
              {video.band && (
                <Link href={`/bands/${video.band.id}`} className="inline-flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group mb-6">
                  {video.band.logoUrl && (
                    <BandLogo 
                      src={video.band.logoUrl} 
                      alt={video.band.name} 
                      className="rounded-lg object-cover" 
                      size={48}
                    />
                  )}
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">{video.band.name}</div>
                  </div>
                  <svg className="w-5 h-5 ml-auto text-gray-400 group-hover:text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
              {video.description && (
                <div className="prose prose-sm max-w-none">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{video.description}</p>
                </div>
              )}
              <div className="mt-8">
                <a href={`https://www.youtube.com/watch?v=${video.youtubeId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 btn-secondary">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  Watch on YouTube
                </a>
              </div>
            </div>
          </div>
          <RelatedVideosSidebar videoId={params.id} />
        </div>
      </div>
    </div>
  );
}