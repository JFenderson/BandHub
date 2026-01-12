import { VideoRecommendations } from '@/components/discovery/VideoRecommendations';

export default function RecommendationsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <VideoRecommendations 
        userId="test-user-1"
        userLocation={{ city: 'Atlanta', state: 'GA' }}
      />
    </div>
  );
}
