'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface FeaturedBandAnalytic {
  bandId: string;
  bandName: string;
  totalClicks: number;
  clickThroughRate: number;
  averagePosition: number;
  daysFeatured: number;
}

interface AnalyticsData {
  analytics: FeaturedBandAnalytic[];
  totalFeaturedClicks: number;
  averageCTR: number;
  bestPerformingPosition: number;
}

export default function FeaturedBandAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getFeaturedAnalytics();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-red-600">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Featured Bands Performance</h3>
        <p className="text-sm text-gray-500">Analytics for bands in the homepage carousel</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-50 border-b border-gray-200">
        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-primary-600">{data.totalFeaturedClicks}</div>
          <div className="text-sm text-gray-500">Total Clicks</div>
        </div>
        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-green-600">{data.averageCTR.toFixed(1)}%</div>
          <div className="text-sm text-gray-500">Average CTR</div>
        </div>
        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-blue-600">{data.analytics.length}</div>
          <div className="text-sm text-gray-500">Featured Bands</div>
        </div>
        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-yellow-600">#{data.bestPerformingPosition}</div>
          <div className="text-sm text-gray-500">Best Position</div>
        </div>
      </div>

      {/* Performance Table */}
      <div className="p-6">
        <h4 className="font-medium text-gray-900 mb-4">Band Performance</h4>
        {data.analytics.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No analytics data available yet. Feature some bands to start tracking.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Band</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Clicks</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">CTR</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Days Featured</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Performance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.analytics
                  .sort((a, b) => b.totalClicks - a.totalClicks)
                  .map((band, index) => {
                    const avgClicksPerDay = band.daysFeatured > 0 ? band.totalClicks / band.daysFeatured : 0;
                    const isTopPerformer = index === 0;
                    const isUnderperforming = band.totalClicks < data.totalFeaturedClicks / data.analytics.length / 2;

                    return (
                      <tr key={band.bandId} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{band.bandName}</span>
                            {isTopPerformer && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Top
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-sm">
                            {band.averagePosition}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-medium">{band.totalClicks}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`font-medium ${band.clickThroughRate > data.averageCTR ? 'text-green-600' : 'text-gray-600'}`}>
                            {band.clickThroughRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-gray-600">{band.daysFeatured}</td>
                        <td className="px-4 py-4 text-center">
                          {isUnderperforming ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Low engagement
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Good
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="p-6 bg-blue-50 border-t border-blue-100">
        <h4 className="font-medium text-blue-900 mb-2">Insights</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Position #{data.bestPerformingPosition} in the carousel gets the most clicks</li>
          <li>• Consider rotating underperforming bands with new recommendations</li>
          <li>• Bands with no clicks after 7 days should be reviewed</li>
        </ul>
      </div>
    </div>
  );
}
