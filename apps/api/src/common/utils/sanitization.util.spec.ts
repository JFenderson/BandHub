import { sanitize} from './sanitization.util';
import { SanitizationLevel, FieldType } from '../types/sanitization.types';

describe('Sanitization Utils', () => {
  describe('XSS Protection', () => {
    it('should remove script tags', () => {
      const result = sanitize('<script>alert("xss")</script>Hello', {
        level: SanitizationLevel.STRICT,
        fieldType: FieldType.TEXT,
      });
      
      expect(result.value).toBe('Hello');
      expect(result.modified).toBe(true);
    });

    it('should remove event handlers', () => {
      const result = sanitize('<img src=x onerror=alert(1)>', {
        level: SanitizationLevel.STRICT,
        fieldType: FieldType.TEXT,
      });
      
      expect(result.value).not.toContain('onerror');
      expect(result.modified).toBe(true);
    });
  });

  describe('URL Validation', () => {
    it('should block javascript: protocol', () => {
      const result = sanitize('javascript:alert(1)', {
        fieldType: FieldType.URL,
      });
      
      expect(result.value).toBe('');
      expect(result.issues).toContain('Blocked javascript: protocol in URL');
    });

    it('should allow valid YouTube URLs', () => {
      const result = sanitize('https://www.youtube.com/watch?v=test', {
        fieldType: FieldType.URL,
        allowedDomains: ['youtube.com'],
      });
      
      expect(result.value).toContain('youtube.com');
      expect(result.modified).toBe(false);
    });
  });
});