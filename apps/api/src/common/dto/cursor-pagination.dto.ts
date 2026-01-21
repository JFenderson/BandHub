import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Cursor data structure for encoding pagination state
 */
export interface CursorData {
  /** Last item's ID */
  id: string;
  /** Sort field value for stable pagination */
  sortValue: string | number | Date;
  /** Sort field name */
  sortField: string;
}

/**
 * DTO for cursor-based pagination requests
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Cursor for the next page (base64 encoded)',
    example: 'eyJpZCI6ImNseDEyMzQ1Iiwic29ydFZhbHVlIjoiMjAyNC0wMS0wMVQwMDowMDowMC4wMDBaIiwic29ydEZpZWxkIjoicHVibGlzaGVkQXQifQ==',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Generic response interface for cursor-paginated results
 */
export interface CursorPaginatedResponse<T> {
  /** Array of items */
  data: T[];
  /** Cursor for the next page (null if no more pages) */
  nextCursor: string | null;
  /** Whether there are more items after this page */
  hasMore: boolean;
}

/**
 * Response class for Swagger documentation
 */
export class CursorPaginatedMeta {
  @ApiProperty({
    description: 'Cursor for the next page',
    example: 'eyJpZCI6ImNseDEyMzQ1Iiwic29ydFZhbHVlIjoiMjAyNC0wMS0wMVQwMDowMDowMC4wMDBaIiwic29ydEZpZWxkIjoicHVibGlzaGVkQXQifQ==',
    nullable: true,
  })
  nextCursor: string | null;

  @ApiProperty({
    description: 'Whether there are more items',
    example: true,
  })
  hasMore: boolean;
}

/**
 * Encode cursor data to base64 string
 * @param data Cursor data containing id, sortValue, and sortField
 * @returns Base64 encoded cursor string
 */
export function encodeCursor(data: CursorData): string {
  const payload = {
    id: data.id,
    sortValue: data.sortValue instanceof Date ? data.sortValue.toISOString() : data.sortValue,
    sortField: data.sortField,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Decode base64 cursor string to cursor data
 * @param cursor Base64 encoded cursor string
 * @returns Decoded cursor data or null if invalid
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);

    // Validate required fields
    if (!parsed.id || parsed.sortValue === undefined || !parsed.sortField) {
      return null;
    }

    return {
      id: parsed.id,
      sortValue: parsed.sortValue,
      sortField: parsed.sortField,
    };
  } catch {
    return null;
  }
}

/**
 * Create a cursor-paginated response from query results
 * @param items Array of items (should fetch limit + 1 to check hasMore)
 * @param limit Page size
 * @param sortField Field used for sorting
 * @param getSortValue Function to extract sort value from an item
 * @returns CursorPaginatedResponse with proper cursor encoding
 */
export function createCursorPaginatedResponse<T extends { id: string }>(
  items: T[],
  limit: number,
  sortField: string,
  getSortValue: (item: T) => string | number | Date,
): CursorPaginatedResponse<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;

  if (hasMore && data.length > 0) {
    const lastItem = data[data.length - 1];
    nextCursor = encodeCursor({
      id: lastItem.id,
      sortValue: getSortValue(lastItem),
      sortField,
    });
  }

  return {
    data,
    nextCursor,
    hasMore,
  };
}

/**
 * Build Prisma cursor condition for cursor-based pagination
 * @param cursorData Decoded cursor data
 * @param sortOrder Sort direction ('asc' or 'desc')
 * @returns Prisma where condition for cursor pagination
 */
export function buildCursorCondition(
  cursorData: CursorData,
  sortOrder: 'asc' | 'desc' = 'desc',
): Record<string, unknown> {
  const { id, sortValue, sortField } = cursorData;
  const operator = sortOrder === 'desc' ? 'lt' : 'gt';

  // For stable pagination, we use a compound condition:
  // (sortField < lastSortValue) OR (sortField = lastSortValue AND id < lastId)
  // This ensures consistent ordering even with duplicate sort values
  return {
    OR: [
      { [sortField]: { [operator]: sortValue } },
      {
        AND: [
          { [sortField]: sortValue },
          { id: { [operator]: id } },
        ],
      },
    ],
  };
}
