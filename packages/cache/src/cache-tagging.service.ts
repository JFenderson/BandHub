import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Cache tag interface
 * Tags allow grouping related cache keys for bulk invalidation
 */
export interface CacheTag {
  name: string;
  keys: string[];
}

/**
 * CacheTaggingService
 * 
 * Provides tag-based cache invalidation for granular control.
 * Tags allow you to group related cache keys and invalidate them together.
 * 
 * Use cases:
 * - Invalidate all caches related to a specific band
 * - Invalidate all video listings across different filters
 * - Clear all homepage-related caches
 * - Invalidate caches for a specific category
 * 
 * Example:
 * ```ts
 * // Store with tags
 * await tagging.setWithTags(
 *   'bands:profile:123',
 *   bandData,
 *   3600,
 *   ['band:123', 'homepage', 'featured']
 * );
 * 
 * // Later, invalidate all 'homepage' tagged caches
 * await tagging.invalidateByTag('homepage');
 * ```
 * 
 * Implementation:
 * - Uses Redis Sets to track tag->keys relationships
 * - Tag keys are stored as "tags:{tagName}" containing a set of cache keys
 * - Each cache key stores its tags in "tags:key:{cacheKey}"
 */
@Injectable()
export class CacheTaggingService {
  private readonly logger = new Logger(CacheTaggingService.name);
  private readonly TAG_PREFIX = 'tags:';
  private readonly KEY_TAGS_PREFIX = 'tags:key:';

  constructor(private readonly cache: CacheService) {}

  /**
   * Set a cache value with associated tags
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   * @param tags - Array of tag names to associate with this key
   */
  async setWithTags(
    key: string,
    value: unknown,
    ttl: number,
    tags: string[],
  ): Promise<void> {
    try {
      // Store the actual cache value
      await this.cache.set(key, value, ttl);

      // Store the tags for this key
      if (tags.length > 0) {
        const keyTagsKey = `${this.KEY_TAGS_PREFIX}${key}`;
        await this.cache.set(keyTagsKey, tags, ttl);

        // Add this key to each tag's set
        const client = this.cache.getClient();
        for (const tag of tags) {
          const tagKey = `${this.TAG_PREFIX}${tag}`;
          await client.sadd(tagKey, key);
          // Set expiry on tag set (longer than cache TTL to handle cleanup)
          await client.expire(tagKey, ttl + 3600);
        }
      }

      this.logger.debug(`Cached ${key} with ${tags.length} tags: ${tags.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to set cache with tags for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Add tags to an existing cache key
   * Useful for adding tags after initial cache creation
   * 
   * @param key - Cache key
   * @param tags - Tags to add
   */
  async addTagToKey(key: string, tags: string | string[]): Promise<void> {
    try {
      const tagsArray = Array.isArray(tags) ? tags : [tags];
      const keyTagsKey = `${this.KEY_TAGS_PREFIX}${key}`;
      
      // Get existing tags
      const existingTags = await this.cache.get<string[]>(keyTagsKey) || [];
      const newTags = [...new Set([...existingTags, ...tagsArray])];
      
      // Get TTL of original key to preserve it
      const client = this.cache.getClient();
      const ttl = await client.ttl(key);
      
      if (ttl > 0) {
        // Update key tags
        await this.cache.set(keyTagsKey, newTags, ttl);

        // Add to tag sets
        for (const tag of tagsArray) {
          const tagKey = `${this.TAG_PREFIX}${tag}`;
          await client.sadd(tagKey, key);
          await client.expire(tagKey, ttl + 3600);
        }

        this.logger.debug(`Added tags ${tagsArray.join(', ')} to ${key}`);
      } else {
        this.logger.warn(`Cannot add tags to ${key}: key not found or expired`);
      }
    } catch (error) {
      this.logger.error(`Failed to add tags to ${key}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate all cache keys associated with a tag
   * 
   * @param tagName - Name of the tag to invalidate
   * @returns Number of keys invalidated
   */
  async invalidateByTag(tagName: string): Promise<number> {
    try {
      const tagKey = `${this.TAG_PREFIX}${tagName}`;
      const client = this.cache.getClient();
      
      // Get all keys associated with this tag
      const keys = await client.smembers(tagKey);
      
      if (keys.length === 0) {
        this.logger.debug(`No keys found for tag: ${tagName}`);
        return 0;
      }

      // Delete all cache keys
      const pipeline = client.pipeline();
      for (const key of keys) {
        pipeline.del(key);
        pipeline.del(`${this.KEY_TAGS_PREFIX}${key}`);
      }
      
      // Delete the tag set itself
      pipeline.del(tagKey);
      
      await pipeline.exec();

      this.logger.log(`Invalidated ${keys.length} keys for tag: ${tagName}`);
      return keys.length;
    } catch (error) {
      this.logger.error(`Failed to invalidate tag ${tagName}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate multiple tags at once
   * 
   * @param tagNames - Array of tag names to invalidate
   * @returns Total number of keys invalidated
   */
  async invalidateByTags(tagNames: string[]): Promise<number> {
    try {
      let totalInvalidated = 0;
      
      for (const tagName of tagNames) {
        const count = await this.invalidateByTag(tagName);
        totalInvalidated += count;
      }

      this.logger.log(`Invalidated ${totalInvalidated} keys across ${tagNames.length} tags`);
      return totalInvalidated;
    } catch (error) {
      this.logger.error(`Failed to invalidate multiple tags:`, error);
      throw error;
    }
  }

  /**
   * Get all cache keys associated with a tag
   * 
   * @param tagName - Name of the tag
   * @returns Array of cache keys
   */
  async getKeysByTag(tagName: string): Promise<string[]> {
    try {
      const tagKey = `${this.TAG_PREFIX}${tagName}`;
      const client = this.cache.getClient();
      const keys = await client.smembers(tagKey);
      
      this.logger.debug(`Found ${keys.length} keys for tag: ${tagName}`);
      return keys;
    } catch (error) {
      this.logger.error(`Failed to get keys for tag ${tagName}:`, error);
      return [];
    }
  }

  /**
   * Get all tags for a specific cache key
   * 
   * @param key - Cache key
   * @returns Array of tag names
   */
  async getTagsForKey(key: string): Promise<string[]> {
    try {
      const keyTagsKey = `${this.KEY_TAGS_PREFIX}${key}`;
      const tags = await this.cache.get<string[]>(keyTagsKey);
      return tags || [];
    } catch (error) {
      this.logger.error(`Failed to get tags for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Get all available tags
   * 
   * @returns Array of tag names
   */
  async getAllTags(): Promise<string[]> {
    try {
      const client = this.cache.getClient();
      const pattern = `${this.TAG_PREFIX}*`;
      
      const tags: string[] = [];
      let cursor = '0';
      
      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        
        // Remove prefix from tag keys
        const tagNames = keys.map(key => key.replace(this.TAG_PREFIX, ''));
        tags.push(...tagNames);
      } while (cursor !== '0');

      this.logger.debug(`Found ${tags.length} tags in cache`);
      return tags;
    } catch (error) {
      this.logger.error('Failed to get all tags:', error);
      return [];
    }
  }

  /**
   * Get statistics about tags
   * Useful for monitoring and debugging
   */
  async getTagStats(): Promise<{ tag: string; keyCount: number }[]> {
    try {
      const allTags = await this.getAllTags();
      const client = this.cache.getClient();
      
      const stats = await Promise.all(
        allTags.map(async (tag) => {
          const tagKey = `${this.TAG_PREFIX}${tag}`;
          const keyCount = await client.scard(tagKey);
          return { tag, keyCount };
        }),
      );

      // Sort by key count descending
      stats.sort((a, b) => b.keyCount - a.keyCount);
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to get tag stats:', error);
      return [];
    }
  }

  /**
   * Clean up orphaned tag entries
   * Removes tag->key mappings where the key no longer exists
   */
  async cleanupOrphanedTags(): Promise<number> {
    try {
      const allTags = await this.getAllTags();
      const client = this.cache.getClient();
      let removedCount = 0;

      for (const tag of allTags) {
        const tagKey = `${this.TAG_PREFIX}${tag}`;
        const keys = await client.smembers(tagKey);
        
        for (const key of keys) {
          // Check if cache key still exists
          const exists = await client.exists(key);
          if (!exists) {
            await client.srem(tagKey, key);
            removedCount++;
          }
        }

        // If tag set is now empty, remove it
        const remaining = await client.scard(tagKey);
        if (remaining === 0) {
          await client.del(tagKey);
        }
      }

      this.logger.log(`Cleaned up ${removedCount} orphaned tag entries`);
      return removedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup orphaned tags:', error);
      return 0;
    }
  }
}
