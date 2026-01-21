import {
  encodeCursor,
  decodeCursor,
  createCursorPaginatedResponse,
  buildCursorCondition,
  CursorData,
} from '../../../../src/common/dto/cursor-pagination.dto';

describe('Cursor Pagination Utilities', () => {
  describe('encodeCursor', () => {
    it('should encode cursor data to base64 string', () => {
      const data: CursorData = {
        id: 'clx12345',
        sortValue: '2024-01-01T00:00:00.000Z',
        sortField: 'publishedAt',
      };

      const encoded = encodeCursor(data);

      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
      // Verify it's valid base64
      expect(() => Buffer.from(encoded, 'base64')).not.toThrow();
    });

    it('should encode Date objects as ISO strings', () => {
      const date = new Date('2024-06-15T12:30:00.000Z');
      const data: CursorData = {
        id: 'video-123',
        sortValue: date,
        sortField: 'createdAt',
      };

      const encoded = encodeCursor(data);
      const decoded = decodeCursor(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.sortValue).toBe('2024-06-15T12:30:00.000Z');
    });

    it('should handle numeric sort values', () => {
      const data: CursorData = {
        id: 'video-456',
        sortValue: 12345,
        sortField: 'viewCount',
      };

      const encoded = encodeCursor(data);
      const decoded = decodeCursor(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.sortValue).toBe(12345);
    });

    it('should handle string sort values', () => {
      const data: CursorData = {
        id: 'band-789',
        sortValue: 'Jackson State University',
        sortField: 'name',
      };

      const encoded = encodeCursor(data);
      const decoded = decodeCursor(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.sortValue).toBe('Jackson State University');
    });
  });

  describe('decodeCursor', () => {
    it('should decode valid base64 cursor string', () => {
      const originalData: CursorData = {
        id: 'test-id-123',
        sortValue: '2024-03-15T10:00:00.000Z',
        sortField: 'publishedAt',
      };

      const encoded = encodeCursor(originalData);
      const decoded = decodeCursor(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.id).toBe('test-id-123');
      expect(decoded!.sortValue).toBe('2024-03-15T10:00:00.000Z');
      expect(decoded!.sortField).toBe('publishedAt');
    });

    it('should return null for invalid base64 string', () => {
      const result = decodeCursor('not-valid-base64!!!');

      expect(result).toBeNull();
    });

    it('should return null for valid base64 but invalid JSON', () => {
      const invalidJson = Buffer.from('not json').toString('base64');
      const result = decodeCursor(invalidJson);

      expect(result).toBeNull();
    });

    it('should return null for missing required fields', () => {
      const missingId = Buffer.from(JSON.stringify({
        sortValue: 'test',
        sortField: 'name',
      })).toString('base64');

      expect(decodeCursor(missingId)).toBeNull();

      const missingSortValue = Buffer.from(JSON.stringify({
        id: 'test',
        sortField: 'name',
      })).toString('base64');

      expect(decodeCursor(missingSortValue)).toBeNull();

      const missingSortField = Buffer.from(JSON.stringify({
        id: 'test',
        sortValue: 'test',
      })).toString('base64');

      expect(decodeCursor(missingSortField)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(decodeCursor('')).toBeNull();
    });

    it('should handle sortValue of 0 (falsy but valid)', () => {
      const data: CursorData = {
        id: 'video-zero',
        sortValue: 0,
        sortField: 'viewCount',
      };

      const encoded = encodeCursor(data);
      const decoded = decodeCursor(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.sortValue).toBe(0);
    });
  });

  describe('createCursorPaginatedResponse', () => {
    interface TestItem {
      id: string;
      name: string;
      createdAt: Date;
    }

    const createTestItems = (count: number): TestItem[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: `item-${i + 1}`,
        name: `Test Item ${i + 1}`,
        createdAt: new Date(2024, 0, i + 1),
      }));
    };

    it('should return hasMore=false when items <= limit', () => {
      const items = createTestItems(5);
      const limit = 10;

      const result = createCursorPaginatedResponse(
        items,
        limit,
        'name',
        (item) => item.name,
      );

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.data).toHaveLength(5);
    });

    it('should return hasMore=true when items > limit', () => {
      const items = createTestItems(11); // One more than limit
      const limit = 10;

      const result = createCursorPaginatedResponse(
        items,
        limit,
        'name',
        (item) => item.name,
      );

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
      expect(result.data).toHaveLength(10); // Should trim to limit
    });

    it('should encode the last item as cursor', () => {
      const items = createTestItems(6);
      const limit = 5;

      const result = createCursorPaginatedResponse(
        items,
        limit,
        'name',
        (item) => item.name,
      );

      expect(result.nextCursor).not.toBeNull();

      const decodedCursor = decodeCursor(result.nextCursor!);
      expect(decodedCursor).not.toBeNull();
      expect(decodedCursor!.id).toBe('item-5'); // Last item in returned data
      expect(decodedCursor!.sortField).toBe('name');
      expect(decodedCursor!.sortValue).toBe('Test Item 5');
    });

    it('should handle empty array', () => {
      const result = createCursorPaginatedResponse(
        [],
        10,
        'name',
        (item: TestItem) => item.name,
      );

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.data).toHaveLength(0);
    });

    it('should handle exactly limit items', () => {
      const items = createTestItems(10);
      const limit = 10;

      const result = createCursorPaginatedResponse(
        items,
        limit,
        'name',
        (item) => item.name,
      );

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.data).toHaveLength(10);
    });

    it('should work with Date sort values', () => {
      const items = createTestItems(6);
      const limit = 5;

      const result = createCursorPaginatedResponse(
        items,
        limit,
        'createdAt',
        (item) => item.createdAt,
      );

      expect(result.nextCursor).not.toBeNull();

      const decodedCursor = decodeCursor(result.nextCursor!);
      expect(decodedCursor).not.toBeNull();
      expect(decodedCursor!.sortField).toBe('createdAt');
    });
  });

  describe('buildCursorCondition', () => {
    it('should build condition for descending sort', () => {
      const cursorData: CursorData = {
        id: 'video-123',
        sortValue: '2024-06-15T12:00:00.000Z',
        sortField: 'publishedAt',
      };

      const condition = buildCursorCondition(cursorData, 'desc');

      expect(condition).toHaveProperty('OR');
      expect(condition.OR).toHaveLength(2);

      // First condition: publishedAt < cursorValue
      expect(condition.OR[0]).toEqual({
        publishedAt: { lt: '2024-06-15T12:00:00.000Z' },
      });

      // Second condition: publishedAt = cursorValue AND id < cursorId
      expect(condition.OR[1]).toEqual({
        AND: [
          { publishedAt: '2024-06-15T12:00:00.000Z' },
          { id: { lt: 'video-123' } },
        ],
      });
    });

    it('should build condition for ascending sort', () => {
      const cursorData: CursorData = {
        id: 'band-456',
        sortValue: 'Jackson State',
        sortField: 'name',
      };

      const condition = buildCursorCondition(cursorData, 'asc');

      expect(condition).toHaveProperty('OR');

      // First condition: name > cursorValue
      expect(condition.OR[0]).toEqual({
        name: { gt: 'Jackson State' },
      });

      // Second condition: name = cursorValue AND id > cursorId
      expect(condition.OR[1]).toEqual({
        AND: [
          { name: 'Jackson State' },
          { id: { gt: 'band-456' } },
        ],
      });
    });

    it('should default to descending sort', () => {
      const cursorData: CursorData = {
        id: 'test-id',
        sortValue: 100,
        sortField: 'viewCount',
      };

      const condition = buildCursorCondition(cursorData);

      // Should use 'lt' for descending
      expect(condition.OR[0]).toEqual({
        viewCount: { lt: 100 },
      });
    });

    it('should handle numeric sort values', () => {
      const cursorData: CursorData = {
        id: 'video-789',
        sortValue: 50000,
        sortField: 'viewCount',
      };

      const condition = buildCursorCondition(cursorData, 'desc');

      expect(condition.OR[0]).toEqual({
        viewCount: { lt: 50000 },
      });
    });
  });

  describe('Round-trip encoding/decoding', () => {
    it('should preserve all data through encode/decode cycle', () => {
      const testCases: CursorData[] = [
        { id: 'simple-id', sortValue: 'simple', sortField: 'name' },
        { id: 'with-special-chars-!@#$', sortValue: 'Test "quoted" value', sortField: 'title' },
        { id: 'numeric-sort', sortValue: 999999999, sortField: 'viewCount' },
        { id: 'zero-value', sortValue: 0, sortField: 'count' },
        { id: 'negative-value', sortValue: -100, sortField: 'offset' },
        { id: 'unicode-id-日本語', sortValue: '日本語テスト', sortField: 'name' },
        { id: 'empty-string-value', sortValue: '', sortField: 'description' },
      ];

      for (const original of testCases) {
        const encoded = encodeCursor(original);
        const decoded = decodeCursor(encoded);

        expect(decoded).not.toBeNull();
        expect(decoded!.id).toBe(original.id);
        expect(decoded!.sortValue).toEqual(
          original.sortValue instanceof Date
            ? original.sortValue.toISOString()
            : original.sortValue
        );
        expect(decoded!.sortField).toBe(original.sortField);
      }
    });
  });
});
