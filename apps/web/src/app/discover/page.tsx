import { TrendingBands } from '@/components/discovery/TrendingBands';

export default function DiscoverPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <TrendingBands limit={24} />
    </div>
  );
}