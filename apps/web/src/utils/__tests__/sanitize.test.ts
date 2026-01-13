import { sanitizeHTML, escapeHTML, containsProfanity, isSpam, extractMentions, formatTimestamp } from '../sanitize';

describe('sanitize utility functions', () => {
  describe('escapeHTML', () => {
    it('escapes HTML special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const result = escapeHTML(input);
      
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });
  });

  describe('containsProfanity', () => {
    it('detects profanity in text', () => {
      expect(containsProfanity('This contains badword1')).toBe(true);
      expect(containsProfanity('This is a clean comment')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(containsProfanity('This contains BADWORD1')).toBe(true);
    });
  });

  describe('isSpam', () => {
    it('detects excessive caps', () => {
      expect(isSpam('THIS IS ALL CAPS AND VERY LONG')).toBe(true);
    });

    it('detects excessive links', () => {
      expect(isSpam('https://link1.com https://link2.com https://link3.com https://link4.com')).toBe(true);
    });

    it('detects repeated characters', () => {
      expect(isSpam('aaaaaaaaaaaaa')).toBe(true);
    });

    it('allows normal text', () => {
      expect(isSpam('This is a normal comment')).toBe(false);
    });
  });

  describe('extractMentions', () => {
    it('extracts username mentions', () => {
      const text = 'Hey @john and @jane, check this out!';
      const mentions = extractMentions(text);
      
      expect(mentions).toEqual(['john', 'jane']);
    });

    it('returns empty array when no mentions', () => {
      const text = 'This has no mentions';
      const mentions = extractMentions(text);
      
      expect(mentions).toEqual([]);
    });
  });

  describe('formatTimestamp', () => {
    it('formats seconds to MM:SS', () => {
      expect(formatTimestamp(90)).toBe('1:30');
      expect(formatTimestamp(65)).toBe('1:05');
    });

    it('formats with hours when needed', () => {
      expect(formatTimestamp(3661)).toBe('1:01:01');
    });

    it('pads minutes and seconds', () => {
      expect(formatTimestamp(5)).toBe('0:05');
      expect(formatTimestamp(125)).toBe('2:05');
    });
  });
});
