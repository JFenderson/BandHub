// Test trending score calculation
describe('TrendingService.calculateTrendingScore', () => {
  it('should favor recent views over total views', () => {
    const recentActivity = calculateTrendingScore({
      viewsThisWeek: 10000,
      recentUploads: 5,
      totalFavorites: 100,
      totalFollowers: 500,
      totalShares: 50,
      avgVideoViews: 1000,
    });

    const oldActivity = calculateTrendingScore({
      viewsThisWeek: 1000,
      recentUploads: 0,
      totalFavorites: 100,
      totalFollowers: 500,
      totalShares: 50,
      avgVideoViews: 1000,
    });

    expect(recentActivity).toBeGreaterThan(oldActivity);
  });
});