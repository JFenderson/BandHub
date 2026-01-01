import { Injectable, Logger } from '@nestjs/common';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * CacheCompressionService
 * 
 * Handles compression/decompression of cache data using gzip
 * 
 * Benefits:
 * - Reduces Redis memory usage by 70-90% for JSON data
 * - Saves money on Redis hosting (pricing often based on memory)
 * - Faster network transfer for large payloads
 * - Transparent to callers (handled by CacheStrategyService)
 * 
 * Only compresses data > 1KB to avoid overhead on small items
 */
@Injectable()
export class CacheCompressionService {
  private readonly logger = new Logger(CacheCompressionService.name);

  /**
   * Compress string data using gzip
   * Returns base64-encoded compressed data
   * 
   * @param data - String to compress
   * @returns Base64-encoded compressed string
   */
  async compress(data: string): Promise<string> {
    try {
      const buffer = Buffer.from(data, 'utf8');
      const compressed = await gzipAsync(buffer);
      return compressed.toString('base64');
    } catch (error) {
      this.logger.error('Compression failed:', error);
      // Return original data if compression fails
      return data;
    }
  }

  /**
   * Decompress gzip data
   * Expects base64-encoded compressed data
   * 
   * @param data - Base64-encoded compressed string
   * @returns Original decompressed string
   */
  async decompress(data: string): Promise<string> {
    try {
      const buffer = Buffer.from(data, 'base64');
      const decompressed = await gunzipAsync(buffer);
      return decompressed.toString('utf8');
    } catch (error) {
      this.logger.error('Decompression failed:', error);
      // Assume data wasn't compressed
      return data;
    }
  }

  /**
   * Calculate compression ratio
   * Useful for logging and metrics
   * 
   * @param original - Original data size in bytes
   * @param compressed - Compressed data size in bytes
   * @returns Compression ratio as percentage (0-100)
   */
  calculateCompressionRatio(original: number, compressed: number): number {
    if (original === 0) return 0;
    return Math.round((1 - compressed / original) * 100);
  }
}