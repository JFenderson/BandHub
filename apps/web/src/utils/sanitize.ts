/**
 * Sanitization utilities for comment content to prevent XSS attacks
 * 
 * SECURITY NOTE: This is a basic sanitization implementation.
 * For production use, consider using a dedicated library like DOMPurify:
 * npm install dompurify
 * import DOMPurify from 'dompurify';
 * const clean = DOMPurify.sanitize(dirty);
 */

const ALLOWED_TAGS = ['b', 'i', 'a', 'p', 'br'];
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title'],
};

// Dangerous URL protocols that should be blocked
const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'about:',
];

/**
 * Validate URL to prevent XSS via href attributes
 */
function isValidUrl(url: string): boolean {
  try {
    const trimmed = url.trim().toLowerCase();
    
    // Check for dangerous protocols
    if (DANGEROUS_PROTOCOLS.some(protocol => trimmed.startsWith(protocol))) {
      return false;
    }
    
    // Only allow http(s) and relative URLs
    if (!trimmed.startsWith('http://') && 
        !trimmed.startsWith('https://') && 
        !trimmed.startsWith('/')) {
      return false;
    }
    
    // Additional validation with URL constructor
    if (trimmed.startsWith('http')) {
      new URL(url);
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Basic HTML sanitizer to prevent XSS
 * This strips all HTML tags and returns plain text.
 * Use this for user input that should not contain any formatting.
 */
export function sanitizeHTML(html: string): string {
  // Create a temporary element to parse HTML
  if (typeof window === 'undefined') {
    // Server-side: just strip all tags
    return html.replace(/<[^>]*>/g, '');
  }
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Recursively sanitize all nodes
  function sanitizeNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      // Only allow specific tags
      if (!ALLOWED_TAGS.includes(tagName)) {
        // Return text content of disallowed tags
        return element.textContent || '';
      }
      
      // Sanitize attributes
      let attrs = '';
      if (ALLOWED_ATTRIBUTES[tagName]) {
        const allowedAttrs = ALLOWED_ATTRIBUTES[tagName];
        Array.from(element.attributes).forEach(attr => {
          if (allowedAttrs.includes(attr.name.toLowerCase())) {
            // Special handling for URLs
            if (attr.name.toLowerCase() === 'href') {
              if (isValidUrl(attr.value)) {
                attrs += ` ${attr.name}="${attr.value}"`;
              }
            } else {
              attrs += ` ${attr.name}="${attr.value}"`;
            }
          }
        });
      }
      
      // Recursively process children
      const children = Array.from(element.childNodes)
        .map(child => sanitizeNode(child))
        .join('');
      
      return `<${tagName}${attrs}>${children}</${tagName}>`;
    }
    
    return '';
  }
  
  return Array.from(temp.childNodes).map(node => sanitizeNode(node)).join('');
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
