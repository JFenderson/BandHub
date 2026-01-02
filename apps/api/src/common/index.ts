// Guards
export { RolesGuard } from './guards/roles.guard';
export { ApiKeyGuard } from './guards/api-key.guard';

// Decorators
export { Roles } from './decorators/roles.decorator';
export { CurrentUser } from './decorators/current-user.decorator';
export type { CurrentUserData } from './decorators/current-user.decorator';
export { GlobalExceptionFilter } from './filters/global-exception.filter';

// Sanitization Decorators
export {
  Sanitize,
  SanitizeText,
  SanitizeDescription,
  SanitizeRichText,
  SanitizeUrl,
  SanitizeYouTubeUrl,
  SanitizeEmail,
  SanitizeSearch,
  SanitizeFilename,
  SanitizeSlug,
  SanitizeHtml,
  SanitizeParams,
  SanitizeAll,
  SANITIZE_METADATA_KEY,
} from './decorators/sanitize.decorator';

// Pipes
export { 
  SanitizationPipe, 
  StrictSanitizationPipe,
  QuerySanitizationPipe,
} from './pipes/sanitization.pipe';

// Validators
export {
  IsSanitized,
  IsSanitizedString,
  IsBandName,
  IsVideoTitle,
  IsDescription,
  IsSearchQuery,
  IsSanitizedConstraint,
} from './validators/sanitized-string.validator';

// Sanitization Utilities
export {
  sanitize,
  sanitizeText,
  sanitizeDescription,
  sanitizeRichText,
  sanitizeHtml,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeFilename,
  sanitizeSlug,
  sanitizeSearch,
  sanitizeBatch,
  encodeHtmlEntities,
  decodeHtmlEntities,
} from './utils/sanitization.util';

// Sanitization Types
export {
  SanitizationLevel,
  FieldType,
  SANITIZATION_PRESETS,
  DEFAULT_SANITIZATION_OPTIONS,
} from './types/sanitization.types';
export type {
  SanitizationOptions,
  SanitizationResult,
  SanitizeMetadata,
} from './types/sanitization.types';


