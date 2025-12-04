import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Get all categories sorted by sortOrder with video counts
   */
  async getAllCategories() {
    return this.prisma.category.findMany({
      orderBy: {
        sortOrder: 'asc',
      },
      include: {
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });
  }

  /**
   * Get a category by ID
   */
  async getCategoryById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  /**
   * Get a category by slug
   */
  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    return category;
  }

  /**
   * Create a new category
   */
  async createCategory(data: {
    name: string;
    slug?: string;
    description?: string;
    sortOrder?: number;
  }) {
    // Auto-generate slug if not provided
    const slug = data.slug || this.generateSlug(data.name);
    
    // Get next sortOrder if not provided
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxSortOrder = await this.prisma.category.aggregate({
        _max: { sortOrder: true },
      });
      sortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1;
    }

    return this.prisma.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        sortOrder,
      },
      include: {
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });
  }

  /**
   * Update a category
   */
  async updateCategory(
    id: string,
    data: {
      name?: string;
      slug?: string;
      description?: string;
      sortOrder?: number;
    },
  ) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return this.prisma.category.update({
      where: { id },
      data,
      include: {
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            videos: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }

  /**
   * Reorder categories - update sort orders based on array of IDs
   */
  async reorderCategories(categoryIds: string[]) {
    // Update each category's sortOrder based on position in array
    const updates = categoryIds.map((id, index) =>
      this.prisma.category.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.getAllCategories();
  }

  /**
   * Merge two categories - moves all videos from source to target, then deletes source
   */
  async mergeCategories(sourceCategoryId: string, targetCategoryId: string) {
    if (sourceCategoryId === targetCategoryId) {
      throw new BadRequestException('Cannot merge a category with itself');
    }

    // Verify both categories exist
    const [sourceCategory, targetCategory] = await Promise.all([
      this.prisma.category.findUnique({
        where: { id: sourceCategoryId },
        include: { _count: { select: { videos: true } } },
      }),
      this.prisma.category.findUnique({
        where: { id: targetCategoryId },
        include: { _count: { select: { videos: true } } },
      }),
    ]);

    if (!sourceCategory) {
      throw new NotFoundException(`Source category with ID ${sourceCategoryId} not found`);
    }

    if (!targetCategory) {
      throw new NotFoundException(`Target category with ID ${targetCategoryId} not found`);
    }

    // Move all videos from source to target
    const videosMoved = await this.prisma.video.updateMany({
      where: { categoryId: sourceCategoryId },
      data: { categoryId: targetCategoryId },
    });

    // Delete the source category
    await this.prisma.category.delete({
      where: { id: sourceCategoryId },
    });

    return {
      message: 'Categories merged successfully',
      videosMoved: videosMoved.count,
      deletedCategory: sourceCategory.name,
      targetCategory: targetCategory.name,
    };
  }

  /**
   * Generate a URL-friendly slug from category name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}