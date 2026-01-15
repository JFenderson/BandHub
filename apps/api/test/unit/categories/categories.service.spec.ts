import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CategoriesService } from '../../../src/modules/categories/categories.service';
import { PrismaService } from '@bandhub/database';

/**
 * Comprehensive Unit Tests for CategoriesService
 * 
 * Coverage areas:
 * - CRUD operations (create, read, update, delete)
 * - Slug generation (auto-generated and custom)
 * - Category reordering (batch updates, transactions)
 * - Category merging (move videos, delete source, transaction rollback)
 * - Error handling (not found, duplicate slugs, database errors)
 * - Validation errors
 */

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrismaService = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      video: {
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllCategories', () => {
    it('should return all categories sorted by sortOrder', async () => {
      const mockCategories = [
        { id: '1', name: 'Category 1', slug: 'category-1', sortOrder: 1, _count: { videos: 10 } },
        { id: '2', name: 'Category 2', slug: 'category-2', sortOrder: 2, _count: { videos: 5 } },
      ];
      prismaService.category.findMany.mockResolvedValue(mockCategories as any);

      const result = await service.getAllCategories();

      expect(result).toEqual(mockCategories);
      expect(prismaService.category.findMany).toHaveBeenCalledWith({
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: { select: { videos: true } },
        },
      });
    });

    it('should return empty array when no categories exist', async () => {
      prismaService.category.findMany.mockResolvedValue([]);

      const result = await service.getAllCategories();

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      prismaService.category.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.getAllCategories()).rejects.toThrow('Database error');
    });
  });

  describe('getCategoryById', () => {
    const mockCategory = {
      id: '1',
      name: 'Test Category',
      slug: 'test-category',
      sortOrder: 1,
      _count: { videos: 10 },
    };

    it('should return category by ID', async () => {
      prismaService.category.findUnique.mockResolvedValue(mockCategory as any);

      const result = await service.getCategoryById('1');

      expect(result).toEqual(mockCategory);
      expect(prismaService.category.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { _count: { select: { videos: true } } },
      });
    });

    it('should throw NotFoundException when category not found', async () => {
      prismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.getCategoryById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.getCategoryById('nonexistent')).rejects.toThrow(
        'Category with ID nonexistent not found'
      );
    });

    it('should handle database errors', async () => {
      prismaService.category.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.getCategoryById('1')).rejects.toThrow('Database error');
    });
  });

  describe('getCategoryBySlug', () => {
    const mockCategory = {
      id: '1',
      name: 'Test Category',
      slug: 'test-category',
      sortOrder: 1,
      _count: { videos: 10 },
    };

    it('should return category by slug', async () => {
      prismaService.category.findUnique.mockResolvedValue(mockCategory as any);

      const result = await service.getCategoryBySlug('test-category');

      expect(result).toEqual(mockCategory);
      expect(prismaService.category.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-category' },
        include: { _count: { select: { videos: true } } },
      });
    });

    it('should throw NotFoundException when slug not found', async () => {
      prismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.getCategoryBySlug('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.getCategoryBySlug('nonexistent')).rejects.toThrow(
        'Category with slug nonexistent not found'
      );
    });

    it('should handle URL-encoded slugs', async () => {
      prismaService.category.findUnique.mockResolvedValue(mockCategory as any);

      await service.getCategoryBySlug('test%20category');

      expect(prismaService.category.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test%20category' },
        include: { _count: { select: { videos: true } } },
      });
    });
  });

  describe('createCategory', () => {
    it('should create category with auto-generated slug', async () => {
      const mockCategory = {
        id: '1',
        name: 'Fifth Quarter',
        slug: 'fifth-quarter',
        sortOrder: 1,
        _count: { videos: 0 },
      };
      prismaService.category.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } } as any);
      prismaService.category.create.mockResolvedValue(mockCategory as any);

      const result = await service.createCategory({
        name: 'Fifth Quarter',
        description: 'Post-game performances',
      });

      expect(result).toEqual(mockCategory);
      expect(prismaService.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Fifth Quarter',
          slug: 'fifth-quarter',
          description: 'Post-game performances',
          sortOrder: 1,
        },
        include: { _count: { select: { videos: true } } },
      });
    });

    it('should create category with custom slug', async () => {
      const mockCategory = {
        id: '1',
        name: 'Field Show',
        slug: 'custom-slug',
        sortOrder: 1,
        _count: { videos: 0 },
      };
      prismaService.category.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } } as any);
      prismaService.category.create.mockResolvedValue(mockCategory as any);

      const result = await service.createCategory({
        name: 'Field Show',
        slug: 'custom-slug',
      });

      expect(result.slug).toBe('custom-slug');
    });

    it('should handle special characters in slug generation', async () => {
      prismaService.category.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } } as any);
      prismaService.category.create.mockResolvedValue({
        id: '1',
        name: 'Test & Category!',
        slug: 'test-category',
        sortOrder: 1,
        _count: { videos: 0 },
      } as any);

      await service.createCategory({ name: 'Test & Category!' });

      expect(prismaService.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: expect.stringMatching(/^[a-z0-9-]+$/),
          }),
        })
      );
    });

    it('should handle unicode characters in slug generation', async () => {
      prismaService.category.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } } as any);
      prismaService.category.create.mockResolvedValue({
        id: '1',
        name: 'Café Música',
        slug: 'cafe-musica',
        sortOrder: 1,
        _count: { videos: 0 },
      } as any);

      await service.createCategory({ name: 'Café Música' });

      expect(prismaService.category.create).toHaveBeenCalled();
    });

    it('should auto-increment sortOrder when not provided', async () => {
      prismaService.category.aggregate.mockResolvedValue({ _max: { sortOrder: 5 } } as any);
      prismaService.category.create.mockResolvedValue({
        id: '1',
        name: 'New Category',
        slug: 'new-category',
        sortOrder: 6,
        _count: { videos: 0 },
      } as any);

      await service.createCategory({ name: 'New Category' });

      expect(prismaService.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sortOrder: 6,
          }),
        })
      );
    });

    it('should use custom sortOrder when provided', async () => {
      prismaService.category.create.mockResolvedValue({
        id: '1',
        name: 'New Category',
        slug: 'new-category',
        sortOrder: 10,
        _count: { videos: 0 },
      } as any);

      await service.createCategory({ name: 'New Category', sortOrder: 10 });

      expect(prismaService.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sortOrder: 10,
          }),
        })
      );
    });

    it('should handle database constraint errors', async () => {
      prismaService.category.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } } as any);
      prismaService.category.create.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`slug`)')
      );

      await expect(service.createCategory({ name: 'Test' })).rejects.toThrow();
    });
  });

  describe('updateCategory', () => {
    const existingCategory = {
      id: '1',
      name: 'Old Name',
      slug: 'old-name',
      sortOrder: 1,
    };

    it('should update category successfully', async () => {
      const updatedCategory = {
        ...existingCategory,
        name: 'New Name',
        _count: { videos: 10 },
      };
      prismaService.category.findUnique.mockResolvedValue(existingCategory as any);
      prismaService.category.update.mockResolvedValue(updatedCategory as any);

      const result = await service.updateCategory('1', { name: 'New Name' });

      expect(result).toEqual(updatedCategory);
      expect(prismaService.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'New Name' },
        include: { _count: { select: { videos: true } } },
      });
    });

    it('should throw NotFoundException when category not found', async () => {
      prismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.updateCategory('nonexistent', { name: 'New' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should update multiple fields', async () => {
      prismaService.category.findUnique.mockResolvedValue(existingCategory as any);
      prismaService.category.update.mockResolvedValue({
        ...existingCategory,
        name: 'New Name',
        description: 'New Description',
        sortOrder: 5,
        _count: { videos: 10 },
      } as any);

      await service.updateCategory('1', {
        name: 'New Name',
        description: 'New Description',
        sortOrder: 5,
      });

      expect(prismaService.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          name: 'New Name',
          description: 'New Description',
          sortOrder: 5,
        },
        include: { _count: { select: { videos: true } } },
      });
    });

    it('should handle partial updates', async () => {
      prismaService.category.findUnique.mockResolvedValue(existingCategory as any);
      prismaService.category.update.mockResolvedValue({
        ...existingCategory,
        description: 'Only description updated',
        _count: { videos: 10 },
      } as any);

      await service.updateCategory('1', { description: 'Only description updated' });

      expect(prismaService.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { description: 'Only description updated' },
        include: { _count: { select: { videos: true } } },
      });
    });
  });

  describe('deleteCategory', () => {
    it('should delete category successfully', async () => {
      const mockCategory = {
        id: '1',
        name: 'Test',
        slug: 'test',
        sortOrder: 1,
        _count: { videos: 0 },
      };
      prismaService.category.findUnique.mockResolvedValue(mockCategory as any);
      prismaService.category.delete.mockResolvedValue(mockCategory as any);

      await service.deleteCategory('1');

      expect(prismaService.category.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException when category not found', async () => {
      prismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.deleteCategory('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should handle categories with videos (cascade)', async () => {
      const categoryWithVideos = {
        id: '1',
        name: 'Test',
        slug: 'test',
        sortOrder: 1,
        _count: { videos: 50 },
      };
      prismaService.category.findUnique.mockResolvedValue(categoryWithVideos as any);
      prismaService.category.delete.mockResolvedValue(categoryWithVideos as any);

      await service.deleteCategory('1');

      expect(prismaService.category.delete).toHaveBeenCalled();
    });

    it('should handle foreign key constraint errors', async () => {
      const mockCategory = { id: '1', name: 'Test', _count: { videos: 0 } };
      prismaService.category.findUnique.mockResolvedValue(mockCategory as any);
      prismaService.category.delete.mockRejectedValue(
        new Error('Foreign key constraint failed')
      );

      await expect(service.deleteCategory('1')).rejects.toThrow();
    });
  });

  describe('reorderCategories', () => {
    it('should reorder multiple categories in a transaction', async () => {
      const categoryIds = ['1', '2', '3'];
      const mockCategories = [
        { id: '2', name: 'Category 2', sortOrder: 0 },
        { id: '1', name: 'Category 1', sortOrder: 1 },
        { id: '3', name: 'Category 3', sortOrder: 2 },
      ];

      prismaService.$transaction.mockResolvedValue([
        { id: '1', sortOrder: 0 },
        { id: '2', sortOrder: 1 },
        { id: '3', sortOrder: 2 },
      ] as any);

      prismaService.category.findMany.mockResolvedValue(mockCategories as any);

      const result = await service.reorderCategories(categoryIds);

      expect(result).toEqual(mockCategories);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should rollback on error during reordering', async () => {
      const categoryIds = ['1', '2'];

      prismaService.$transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(service.reorderCategories(categoryIds)).rejects.toThrow('Transaction failed');
    });

    it('should handle empty reorder array', async () => {
      prismaService.$transaction.mockResolvedValue([]);
      prismaService.category.findMany.mockResolvedValue([]);

      const result = await service.reorderCategories([]);

      expect(result).toEqual([]);
    });
  });

  describe('mergeCategories', () => {
    it('should merge source category into target category', async () => {
      const sourceCategory = { id: 'source', name: 'Source', _count: { videos: 10 } };
      const targetCategory = { id: 'target', name: 'Target', _count: { videos: 5 } };

      prismaService.category.findUnique
        .mockResolvedValueOnce(sourceCategory as any)
        .mockResolvedValueOnce(targetCategory as any);

      prismaService.video.updateMany.mockResolvedValue({ count: 10 } as any);
      prismaService.category.delete.mockResolvedValue(sourceCategory as any);

      const result = await service.mergeCategories('source', 'target');

      expect(result).toEqual({
        message: 'Categories merged successfully',
        videosMoved: 10,
        deletedCategory: 'Source',
        targetCategory: 'Target',
      });
      expect(prismaService.video.updateMany).toHaveBeenCalledWith({
        where: { categoryId: 'source' },
        data: { categoryId: 'target' },
      });
      expect(prismaService.category.delete).toHaveBeenCalledWith({
        where: { id: 'source' },
      });
    });

    it('should throw NotFoundException when source category not found', async () => {
      prismaService.category.findUnique.mockResolvedValueOnce(null);

      await expect(service.mergeCategories('source', 'target')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when target category not found', async () => {
      const sourceCategory = { id: 'source', name: 'Source', _count: { videos: 10 } };

      prismaService.category.findUnique
        .mockResolvedValueOnce(sourceCategory as any)
        .mockResolvedValueOnce(null);

      await expect(service.mergeCategories('source', 'target')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when trying to merge into self', async () => {
      await expect(service.mergeCategories('same-id', 'same-id')).rejects.toThrow(
        BadRequestException
      );
      await expect(service.mergeCategories('same-id', 'same-id')).rejects.toThrow(
        'Cannot merge a category with itself'
      );
    });

    it('should handle error during video update', async () => {
      const sourceCategory = { id: 'source', name: 'Source', _count: { videos: 10 } };
      const targetCategory = { id: 'target', name: 'Target', _count: { videos: 5 } };

      prismaService.category.findUnique
        .mockResolvedValueOnce(sourceCategory as any)
        .mockResolvedValueOnce(targetCategory as any);

      prismaService.video.updateMany.mockRejectedValue(new Error('Update failed'));

      await expect(service.mergeCategories('source', 'target')).rejects.toThrow('Update failed');
    });
  });

  describe('Slug generation edge cases', () => {
    it('should handle names with only special characters', async () => {
      prismaService.category.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } } as any);
      prismaService.category.create.mockResolvedValue({
        id: '1',
        name: '!!!',
        slug: '',
        sortOrder: 1,
        _count: { videos: 0 },
      } as any);

      await service.createCategory({ name: '!!!' });

      expect(prismaService.category.create).toHaveBeenCalled();
    });

    it('should handle very long names', async () => {
      const longName = 'A'.repeat(255);
      prismaService.category.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } } as any);
      prismaService.category.create.mockResolvedValue({
        id: '1',
        name: longName,
        slug: 'a'.repeat(255),
        sortOrder: 1,
        _count: { videos: 0 },
      } as any);

      await service.createCategory({ name: longName });

      expect(prismaService.category.create).toHaveBeenCalled();
    });

    it('should handle names with mixed case', async () => {
      prismaService.category.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } } as any);
      prismaService.category.create.mockResolvedValue({
        id: '1',
        name: 'MiXeD CaSe NaMe',
        slug: 'mixed-case-name',
        sortOrder: 1,
        _count: { videos: 0 },
      } as any);

      await service.createCategory({ name: 'MiXeD CaSe NaMe' });

      expect(prismaService.category.create).toHaveBeenCalled();
    });
  });
});
