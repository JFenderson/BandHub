import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { DatabaseService } from '../../database/database.service';

// Mock DatabaseService
const mockDatabaseService = {
  video: {
    findUnique: jest.fn(),
  },
  band: {
    findUnique: jest.fn(),
  },
  favoriteVideo: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  favoriteBand: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  watchLater: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('FavoritesService', () => {
  let service: FavoritesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('addFavoriteVideo', () => {
    const userId = 'user-1';
    const videoId = 'video-1';
    const mockVideo = { id: videoId, title: 'Test Video' };
    const mockFavorite = {
      id: 'fav-1',
      userId,
      videoId,
      notes: null,
      createdAt: new Date(),
      video: {
        ...mockVideo,
        band: { id: 'band-1', name: 'Test Band', slug: 'test-band', logoUrl: null },
        category: null,
      },
    };

    it('should add video to favorites successfully', async () => {
      mockDatabaseService.video.findUnique.mockResolvedValue(mockVideo);
      mockDatabaseService.favoriteVideo.findUnique.mockResolvedValue(null);
      mockDatabaseService.favoriteVideo.create.mockResolvedValue(mockFavorite);

      const result = await service.addFavoriteVideo(userId, videoId);

      expect(result).toEqual(mockFavorite);
      expect(mockDatabaseService.video.findUnique).toHaveBeenCalledWith({
        where: { id: videoId },
      });
      expect(mockDatabaseService.favoriteVideo.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if video does not exist', async () => {
      mockDatabaseService.video.findUnique.mockResolvedValue(null);

      await expect(service.addFavoriteVideo(userId, videoId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if video is already favorited', async () => {
      mockDatabaseService.video.findUnique.mockResolvedValue(mockVideo);
      mockDatabaseService.favoriteVideo.findUnique.mockResolvedValue(mockFavorite);

      await expect(service.addFavoriteVideo(userId, videoId)).rejects.toThrow(ConflictException);
    });

    it('should add notes when provided', async () => {
      const notes = 'Great performance!';
      mockDatabaseService.video.findUnique.mockResolvedValue(mockVideo);
      mockDatabaseService.favoriteVideo.findUnique.mockResolvedValue(null);
      mockDatabaseService.favoriteVideo.create.mockResolvedValue({ ...mockFavorite, notes });

      await service.addFavoriteVideo(userId, videoId, { notes });

      expect(mockDatabaseService.favoriteVideo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes }),
        }),
      );
    });
  });

  describe('removeFavoriteVideo', () => {
    const userId = 'user-1';
    const videoId = 'video-1';
    const mockFavorite = { id: 'fav-1', userId, videoId };

    it('should remove video from favorites successfully', async () => {
      mockDatabaseService.favoriteVideo.findUnique.mockResolvedValue(mockFavorite);
      mockDatabaseService.favoriteVideo.delete.mockResolvedValue(mockFavorite);

      const result = await service.removeFavoriteVideo(userId, videoId);

      expect(result).toEqual({ message: 'Video removed from favorites' });
      expect(mockDatabaseService.favoriteVideo.delete).toHaveBeenCalledWith({
        where: { id: mockFavorite.id },
      });
    });

    it('should throw NotFoundException if video is not in favorites', async () => {
      mockDatabaseService.favoriteVideo.findUnique.mockResolvedValue(null);

      await expect(service.removeFavoriteVideo(userId, videoId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('isVideoFavorited', () => {
    const userId = 'user-1';
    const videoId = 'video-1';

    it('should return true if video is favorited', async () => {
      mockDatabaseService.favoriteVideo.findUnique.mockResolvedValue({ id: 'fav-1' });

      const result = await service.isVideoFavorited(userId, videoId);

      expect(result).toBe(true);
    });

    it('should return false if video is not favorited', async () => {
      mockDatabaseService.favoriteVideo.findUnique.mockResolvedValue(null);

      const result = await service.isVideoFavorited(userId, videoId);

      expect(result).toBe(false);
    });
  });

  describe('followBand', () => {
    const userId = 'user-1';
    const bandId = 'band-1';
    const mockBand = { id: bandId, name: 'Test Band' };
    const mockFollow = {
      id: 'follow-1',
      userId,
      bandId,
      notificationsEnabled: true,
      createdAt: new Date(),
      band: {
        ...mockBand,
        slug: 'test-band',
        schoolName: 'Test School',
        logoUrl: null,
        state: 'GA',
        _count: { videos: 10 },
      },
    };

    it('should follow band successfully', async () => {
      mockDatabaseService.band.findUnique.mockResolvedValue(mockBand);
      mockDatabaseService.favoriteBand.findUnique.mockResolvedValue(null);
      mockDatabaseService.favoriteBand.create.mockResolvedValue(mockFollow);

      const result = await service.followBand(userId, bandId);

      expect(result).toEqual(mockFollow);
      expect(mockDatabaseService.band.findUnique).toHaveBeenCalledWith({
        where: { id: bandId },
      });
      expect(mockDatabaseService.favoriteBand.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if band does not exist', async () => {
      mockDatabaseService.band.findUnique.mockResolvedValue(null);

      await expect(service.followBand(userId, bandId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already following', async () => {
      mockDatabaseService.band.findUnique.mockResolvedValue(mockBand);
      mockDatabaseService.favoriteBand.findUnique.mockResolvedValue(mockFollow);

      await expect(service.followBand(userId, bandId)).rejects.toThrow(ConflictException);
    });
  });

  describe('unfollowBand', () => {
    const userId = 'user-1';
    const bandId = 'band-1';
    const mockFollow = { id: 'follow-1', userId, bandId };

    it('should unfollow band successfully', async () => {
      mockDatabaseService.favoriteBand.findUnique.mockResolvedValue(mockFollow);
      mockDatabaseService.favoriteBand.delete.mockResolvedValue(mockFollow);

      const result = await service.unfollowBand(userId, bandId);

      expect(result).toEqual({ message: 'Unfollowed band' });
      expect(mockDatabaseService.favoriteBand.delete).toHaveBeenCalledWith({
        where: { id: mockFollow.id },
      });
    });

    it('should throw NotFoundException if not following', async () => {
      mockDatabaseService.favoriteBand.findUnique.mockResolvedValue(null);

      await expect(service.unfollowBand(userId, bandId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBandFollowerCount', () => {
    const bandId = 'band-1';

    it('should return follower count', async () => {
      mockDatabaseService.favoriteBand.count.mockResolvedValue(42);

      const result = await service.getBandFollowerCount(bandId);

      expect(result).toBe(42);
      expect(mockDatabaseService.favoriteBand.count).toHaveBeenCalledWith({
        where: { bandId },
      });
    });
  });

  describe('addToWatchLater', () => {
    const userId = 'user-1';
    const videoId = 'video-1';
    const mockVideo = { id: videoId, title: 'Test Video' };
    const mockWatchLater = {
      id: 'wl-1',
      userId,
      videoId,
      watched: false,
      watchedAt: null,
      createdAt: new Date(),
      video: {
        ...mockVideo,
        band: { id: 'band-1', name: 'Test Band', slug: 'test-band', logoUrl: null },
      },
    };

    it('should add video to watch later successfully', async () => {
      mockDatabaseService.video.findUnique.mockResolvedValue(mockVideo);
      mockDatabaseService.watchLater.findUnique.mockResolvedValue(null);
      mockDatabaseService.watchLater.create.mockResolvedValue(mockWatchLater);

      const result = await service.addToWatchLater(userId, videoId);

      expect(result).toEqual(mockWatchLater);
      expect(mockDatabaseService.watchLater.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if video does not exist', async () => {
      mockDatabaseService.video.findUnique.mockResolvedValue(null);

      await expect(service.addToWatchLater(userId, videoId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already in watch later', async () => {
      mockDatabaseService.video.findUnique.mockResolvedValue(mockVideo);
      mockDatabaseService.watchLater.findUnique.mockResolvedValue(mockWatchLater);

      await expect(service.addToWatchLater(userId, videoId)).rejects.toThrow(ConflictException);
    });
  });

  describe('updateWatchLater', () => {
    const userId = 'user-1';
    const videoId = 'video-1';
    const mockWatchLater = { id: 'wl-1', userId, videoId, watched: false };

    it('should mark video as watched', async () => {
      mockDatabaseService.watchLater.findUnique.mockResolvedValue(mockWatchLater);
      mockDatabaseService.watchLater.update.mockResolvedValue({ 
        ...mockWatchLater, 
        watched: true, 
        watchedAt: new Date() 
      });

      const result = await service.updateWatchLater(userId, videoId, { watched: true });

      expect(result.watched).toBe(true);
      expect(mockDatabaseService.watchLater.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ watched: true }),
        }),
      );
    });

    it('should mark video as unwatched', async () => {
      mockDatabaseService.watchLater.findUnique.mockResolvedValue({ ...mockWatchLater, watched: true });
      mockDatabaseService.watchLater.update.mockResolvedValue({ 
        ...mockWatchLater, 
        watched: false, 
        watchedAt: null 
      });

      const result = await service.updateWatchLater(userId, videoId, { watched: false });

      expect(result.watched).toBe(false);
    });

    it('should throw NotFoundException if not in watch later', async () => {
      mockDatabaseService.watchLater.findUnique.mockResolvedValue(null);

      await expect(service.updateWatchLater(userId, videoId, { watched: true })).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWatchLaterStats', () => {
    const userId = 'user-1';

    it('should return correct stats', async () => {
      mockDatabaseService.watchLater.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(6); // watched

      const result = await service.getWatchLaterStats(userId);

      expect(result).toEqual({
        total: 10,
        watched: 6,
        unwatched: 4,
      });
    });
  });

  describe('getVideoStatus', () => {
    const userId = 'user-1';
    const videoId = 'video-1';

    it('should return combined status', async () => {
      mockDatabaseService.favoriteVideo.findUnique.mockResolvedValue({ id: 'fav-1' });
      mockDatabaseService.watchLater.findUnique.mockResolvedValue(null);

      const result = await service.getVideoStatus(userId, videoId);

      expect(result).toEqual({
        isFavorited: true,
        isInWatchLater: false,
      });
    });
  });
});
