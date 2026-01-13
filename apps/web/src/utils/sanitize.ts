/**
 * Sanitization utilities for comment content to prevent XSS attacks
 */

const ALLOWED_TAGS = ['b', 'i', 'a', 'p', 'br'];
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title'],
};

/**
 * Basic HTML sanitizer to prevent XSS
 * In production, consider using DOMPurify or similar library
 */
export function sanitizeHTML(html: string): string {
  // Create a temporary element
  const temp = document.createElement('div');
  temp.textContent = html;
  let sanitized = temp.innerHTML;

  // Allow only specific tags
  const tagRegex = /<(\/?)([\w]+)([^>]*)>/g;
  sanitized = sanitized.replace(tagRegex, (match, slash, tag, attrs) => {
    if (!ALLOWED_TAGS.includes(tag.toLowerCase())) {
      return '';
    }
    
    // For allowed tags, sanitize attributes
    if (attrs && ALLOWED_ATTRIBUTES[tag.toLowerCase()]) {
      const allowedAttrs = ALLOWED_ATTRIBUTES[tag.toLowerCase()];
      const attrRegex = /([\w-]+)\s*=\s*["']([^"']*)["']/g;
      let cleanAttrs = '';
      let attrMatch;
      
      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        const [, attrName, attrValue] = attrMatch;
        if (allowedAttrs.includes(attrName.toLowerCase())) {
          // Basic URL validation for href
          if (attrName.toLowerCase() === 'href') {
            if (attrValue.startsWith('http://') || attrValue.startsWith('https://')) {
              cleanAttrs += ` ${attrName}="${attrValue}"`;
            }
          } else {
            cleanAttrs += ` ${attrName}="${attrValue}"`;
          }
        }
      }
      
      return `<${slash}${tag}${cleanAttrs}>`;
    }
    
    return `<${slash}${tag}>`;
  });

  return sanitized;
}

/**
 * Escape HTML to prevent script injection
 */
export function escapeHTML(text: string): string {
  const temp = document.createElement('div');
  temp.textContent = text;
  return temp.innerHTML;
}

/**
 * Detect and filter profanity
 */
const PROFANITY_LIST = [
  // Add profanity words here - keeping minimal for now
  'badword1', 'badword2'
];

export function containsProfanity(text: string): boolean {
  const lowerText = text.toLowerCase();
  return PROFANITY_LIST.some(word => lowerText.includes(word));
}

/**
 * Detect spam patterns
 */
export function isSpam(text: string): boolean {
  // Check for excessive caps
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.7 && text.length > 10) {
    return true;
  }

  // Check for excessive links
  const linkCount = (text.match(/https?:\/\//g) || []).length;
  if (linkCount > 3) {
    return true;
  }

  // Check for repeated characters
  if (/(.)\1{10,}/.test(text)) {
    return true;
  }

  return false;
}

/**
 * Extract mentions from text
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
