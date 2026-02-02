import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { PlaylistsService } from '../../../../src/modules/playlists/playlists.service';
import { PrismaService } from '@bandhub/database';
import { PlaylistCollaboratorRole } from '../../../../src/modules/playlists/dto/collaborator.dto';

describe('PlaylistsService', () => {
  let service: PlaylistsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    playlist: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    playlistVideo: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    playlistCollaborator: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    playlistFollower: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    playlistShare: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    video: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaylistsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PlaylistsService>(PlaylistsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addCollaborator', () => {
    it('should add a collaborator to a playlist', async () => {
      const playlistId = 'playlist-1';
      const userId = 'user-1';
      const collaboratorUserId = 'user-2';
      const dto = { userId: collaboratorUserId, role: PlaylistCollaboratorRole.EDITOR };

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        userId,
        name: 'Test Playlist',
      });

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: collaboratorUserId,
        name: 'Collaborator User',
      });

      mockPrismaService.playlistCollaborator.findUnique.mockResolvedValue(null);

      mockPrismaService.playlistCollaborator.create.mockResolvedValue({
        id: 'collab-1',
        playlistId,
        userId: collaboratorUserId,
        role: PlaylistCollaboratorRole.EDITOR,
        user: {
          id: collaboratorUserId,
          name: 'Collaborator User',
          username: 'collabuser',
          avatar: null,
        },
      });

      const result = await service.addCollaborator(playlistId, userId, dto);

      expect(result.userId).toBe(collaboratorUserId);
      expect(result.role).toBe(PlaylistCollaboratorRole.EDITOR);
      expect(mockPrismaService.playlistCollaborator.create).toHaveBeenCalledWith({
        data: {
          playlistId,
          userId: collaboratorUserId,
          role: PlaylistCollaboratorRole.EDITOR,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
      });
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      const playlistId = 'playlist-1';
      const userId = 'user-1';
      const collaboratorUserId = 'user-2';
      const dto = { userId: collaboratorUserId, role: PlaylistCollaboratorRole.EDITOR };

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        userId: 'different-user',
        name: 'Test Playlist',
      });

      await expect(service.addCollaborator(playlistId, userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if user is already a collaborator', async () => {
      const playlistId = 'playlist-1';
      const userId = 'user-1';
      const collaboratorUserId = 'user-2';
      const dto = { userId: collaboratorUserId, role: PlaylistCollaboratorRole.EDITOR };

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        userId,
        name: 'Test Playlist',
      });

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: collaboratorUserId,
        name: 'Collaborator User',
      });

      mockPrismaService.playlistCollaborator.findUnique.mockResolvedValue({
        id: 'existing-collab',
        playlistId,
        userId: collaboratorUserId,
      });

      await expect(service.addCollaborator(playlistId, userId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('followPlaylist', () => {
    it('should follow a public playlist', async () => {
      const playlistId = 'playlist-1';
      const userId = 'user-1';

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        userId: 'owner-id',
        isPublic: true,
      });

      mockPrismaService.playlistFollower.findUnique.mockResolvedValue(null);

      mockPrismaService.playlistFollower.create.mockResolvedValue({
        id: 'follower-1',
        playlistId,
        userId,
      });

      const result = await service.followPlaylist(playlistId, userId);

      expect(result.message).toBe('Playlist followed successfully');
      expect(mockPrismaService.playlistFollower.create).toHaveBeenCalledWith({
        data: {
          playlistId,
          userId,
        },
      });
    });

    it('should throw ForbiddenException for private playlists', async () => {
      const playlistId = 'playlist-1';
      const userId = 'user-1';

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        userId: 'owner-id',
        isPublic: false,
      });

      await expect(service.followPlaylist(playlistId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if already following', async () => {
      const playlistId = 'playlist-1';
      const userId = 'user-1';

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        userId: 'owner-id',
        isPublic: true,
      });

      mockPrismaService.playlistFollower.findUnique.mockResolvedValue({
        id: 'existing-follower',
        playlistId,
        userId,
      });

      await expect(service.followPlaylist(playlistId, userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('generateShareLink', () => {
    it('should generate a share link for a playlist', async () => {
      const playlistId = 'playlist-1';
      const userId = 'user-1';

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        userId,
        name: 'Test Playlist',
        collaborators: [],
      });

      mockPrismaService.playlistShare.create.mockResolvedValue({
        id: 'share-1',
        playlistId,
        token: 'test-token',
        views: 0,
        expiresAt: null,
      });

      mockPrismaService.playlist.update.mockResolvedValue({
        id: playlistId,
        shareLink: 'test-token',
      });

      const result = await service.generateShareLink(playlistId, userId);

      expect(result.shareLink).toBeDefined();
      expect(result.shareUrl).toContain('/share/');
      expect(mockPrismaService.playlistShare.create).toHaveBeenCalled();
    });
  });

  describe('markAsFeatured', () => {
    it('should mark a public playlist as featured', async () => {
      const playlistId = 'playlist-1';

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        isPublic: true,
        isFeatured: false,
      });

      mockPrismaService.playlist.update.mockResolvedValue({
        id: playlistId,
        isFeatured: true,
        featuredAt: new Date(),
      });

      const result = await service.markAsFeatured(playlistId);

      expect(result.isFeatured).toBe(true);
      expect(mockPrismaService.playlist.update).toHaveBeenCalledWith({
        where: { id: playlistId },
        data: {
          isFeatured: true,
          featuredAt: expect.any(Date),
        },
      });
    });

    it('should throw BadRequestException for private playlists', async () => {
      const playlistId = 'playlist-1';

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        isPublic: false,
        isFeatured: false,
      });

      await expect(service.markAsFeatured(playlistId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('canEditPlaylist', () => {
    it('should return true if user is the owner', async () => {
      const playlistId = 'playlist-1';
      const userId = 'user-1';

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        userId,
        collaborators: [],
      });

      // Access private method via type casting
      const result = await (service as any).canEditPlaylist(playlistId, userId);

      expect(result).toBe(true);
    });

    it('should return true if user is a collaborator with EDITOR role', async () => {
      const playlistId = 'playlist-1';
      const userId = 'user-1';

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        userId: 'owner-id',
        collaborators: [
          {
            userId,
            role: PlaylistCollaboratorRole.EDITOR,
          },
        ],
      });

      const result = await (service as any).canEditPlaylist(playlistId, userId);

      expect(result).toBe(true);
    });

    it('should return false if user is not owner or collaborator', async () => {
      const playlistId = 'playlist-1';
      const userId = 'user-1';

      mockPrismaService.playlist.findUnique.mockResolvedValue({
        id: playlistId,
        userId: 'owner-id',
        collaborators: [],
      });

      const result = await (service as any).canEditPlaylist(playlistId, userId);

      expect(result).toBe(false);
    });
  });
});
