import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Get all categories sorted by sortOrder
   */
  async getAllCategories() {
    return this.prisma.category.findMany({
      orderBy: {
        sortOrder: 'asc',
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
    slug: string;
    description?: string;
    sortOrder?: number;
  }) {
    return this.prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
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
}