import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ThrottlerException } from '@nestjs/throttler';

/**
 * Global Exception Filter for HBCU Band Hub API
 * 
 * Handles all types of exceptions and returns user-friendly error responses:
 * - HTTP exceptions (from NestJS)
 * - Prisma database errors (unique constraints, foreign keys, etc.)
 * - Validation errors (class-validator)
 * - Rate limiting errors (Throttler)
 * - YouTube API errors
 * - File upload errors
 * - Unknown/unexpected errors
 * 
 * Features:
 * - User-friendly error messages (never exposes internal details in production)
 * - Detailed logging for debugging
 * - Request correlation IDs for tracing
 * - Environment-specific behavior (detailed errors in dev, generic in prod)
 * - Structured error response format
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Extract correlation ID from request (added by correlation middleware)
    const correlationId = request.headers['x-correlation-id'] as string || 'unknown';

    // Determine status code and error details
    const errorResponse = this.buildErrorResponse(exception, request, correlationId);

    // Log the error with full details for debugging
    this.logError(exception, request, correlationId, errorResponse);

    // Send the response
    response.status(errorResponse.statusCode).json(errorResponse);
  }

  /**
   * Build a structured error response based on exception type
   */
  private buildErrorResponse(exception: unknown, request: Request, correlationId: string) {
    const timestamp = new Date().toISOString();
    const path = request.url;

    // Handle HTTP exceptions (most common case)
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, path, timestamp, correlationId);
    }

    // Handle Prisma database errors
    if (this.isPrismaError(exception)) {
      return this.handlePrismaError(exception as Prisma.PrismaClientKnownRequestError, path, timestamp, correlationId);
    }

    // Handle Throttler rate limiting errors
    if (exception instanceof ThrottlerException) {
      return this.handleRateLimitError(exception, path, timestamp, correlationId);
    }

    // Handle YouTube API errors (identified by error structure)
    if (this.isYouTubeError(exception)) {
      return this.handleYouTubeError(exception as any, path, timestamp, correlationId);
    }

    // Handle file upload errors (Multer errors)
    if (this.isMulterError(exception)) {
      return this.handleFileUploadError(exception as any, path, timestamp, correlationId);
    }

    // Handle unknown errors
    return this.handleUnknownError(exception, path, timestamp, correlationId);
  }

  /**
   * Handle standard NestJS HTTP exceptions
   */
  private handleHttpException(exception: HttpException, path: string, timestamp: string, correlationId: string) {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extract error details
    let error = 'Error';
    let message: string | string[] = exception.message;
    let details: string[] | undefined;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseObj = exceptionResponse as any;
      error = responseObj.error || error;
      message = responseObj.message || message;
      
      // Handle validation errors (class-validator format)
      if (Array.isArray(responseObj.message)) {
        details = responseObj.message;
        message = 'Validation failed';
      }
    }

    return {
      statusCode: status,
      error,
      message,
      ...(details && { details }),
      timestamp,
      path,
      correlationId,
    };
  }

  /**
   * Handle Prisma database errors with user-friendly messages
   */
  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    path: string,
    timestamp: string,
    correlationId: string
  ) {
    const status = HttpStatus.BAD_REQUEST;
    let message = 'Database operation failed';
    let details: string[] | undefined;

    switch (exception.code) {
      // Unique constraint violation
      case 'P2002':
        const target = (exception.meta?.target as string[]) || [];
        const field = target[0] || 'field';
        message = `A record with this ${field} already exists`;
        details = [`${field} must be unique`];
        break;

      // Foreign key constraint violation
      case 'P2003':
        message = 'Related record not found';
        details = ['The referenced record does not exist'];
        break;

      // Record not found
      case 'P2025':
        message = 'Record not found';
        details = ['The requested record does not exist'];
        break;

      // Record to delete does not exist
      case 'P2018':
        message = 'Record not found';
        details = ['Cannot delete a record that does not exist'];
        break;

      // Invalid ID format
      case 'P2023':
        message = 'Invalid ID format';
        details = ['The provided ID is not valid'];
        break;

      // Dependent records exist (cannot delete)
      case 'P2014':
        message = 'Cannot delete record';
        details = ['This record is referenced by other records and cannot be deleted'];
        break;

      // Value too long for column
      case 'P2000':
        const column = (exception.meta?.column_name as string) || 'field';
        message = 'Value too long';
        details = [`The value for ${column} exceeds the maximum length`];
        break;

      // Required field missing
      case 'P2012':
        const missingField = (exception.meta?.field_name as string) || 'field';
        message = 'Required field missing';
        details = [`${missingField} is required`];
        break;

      default:
        message = 'Database operation failed';
        // Only expose error code in development
        if (this.isDevelopment) {
          details = [`Prisma error code: ${exception.code}`];
        }
    }

    return {
      statusCode: status,
      error: 'Bad Request',
      message,
      ...(details && { details }),
      timestamp,
      path,
      correlationId,
    };
  }

  /**
   * Handle rate limiting errors
   */
  private handleRateLimitError(
    exception: ThrottlerException,
    path: string,
    timestamp: string,
    correlationId: string
  ) {
    return {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      details: ['You have made too many requests in a short period. Please wait before trying again.'],
      timestamp,
      path,
      correlationId,
    };
  }

  /**
   * Handle YouTube API errors
   */
  private handleYouTubeError(exception: any, path: string, timestamp: string, correlationId: string) {
    let status = HttpStatus.BAD_GATEWAY;
    let message = 'YouTube API error';
    let details: string[] | undefined;

    // Handle custom YouTube error types from YouTubeService
    if (exception.name === 'YouTubeQuotaExceededError') {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'YouTube API quota exceeded';
      details = ['The daily YouTube API quota has been exceeded. Please try again tomorrow.'];
    } else if (exception.name === 'YouTubeRateLimitError') {
      status = HttpStatus.TOO_MANY_REQUESTS;
      message = 'YouTube API rate limit reached';
      details = ['Too many requests to YouTube API. Please try again later.'];
    } else if (exception.response?.data?.error) {
      // Handle YouTube API error responses
      const ytError = exception.response.data.error;
      message = ytError.message || 'YouTube API error';
      
      if (ytError.code === 403) {
        if (ytError.errors?.[0]?.reason === 'quotaExceeded') {
          status = HttpStatus.SERVICE_UNAVAILABLE;
          message = 'YouTube API quota exceeded';
          details = ['The daily YouTube API quota has been exceeded. Please try again tomorrow.'];
        } else if (ytError.errors?.[0]?.reason === 'rateLimitExceeded') {
          status = HttpStatus.TOO_MANY_REQUESTS;
          message = 'YouTube API rate limit reached';
          details = ['Too many requests to YouTube API. Please try again later.'];
        }
      }
    }

    // Don't expose internal YouTube API details in production
    if (!this.isDevelopment) {
      details = ['An error occurred while communicating with YouTube. Please try again later.'];
    }

    return {
      statusCode: status,
      error: 'External Service Error',
      message,
      ...(details && { details }),
      timestamp,
      path,
      correlationId,
    };
  }

  /**
   * Handle file upload errors (Multer)
   */
  private handleFileUploadError(exception: any, path: string, timestamp: string, correlationId: string) {
    let message = 'File upload failed';
    let details: string[] = [];

    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large';
        details = ['The uploaded file exceeds the maximum allowed size'];
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        details = ['You can only upload a limited number of files at once'];
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        details = ['An unexpected file was uploaded'];
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        details = ['The field name is too long'];
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        details = ['The field value is too long'];
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        details = ['Too many form fields were submitted'];
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many parts';
        details = ['The request has too many parts'];
        break;
      default:
        if (exception.message?.includes('Only images are allowed')) {
          message = 'Invalid file type';
          details = ['Only image files are allowed'];
        } else if (exception.message) {
          message = 'File upload failed';
          if (this.isDevelopment) {
            details = [exception.message];
          }
        }
    }

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'File Upload Error',
      message,
      ...(details.length && { details }),
      timestamp,
      path,
      correlationId,
    };
  }

  /**
   * Handle unknown/unexpected errors
   */
  private handleUnknownError(exception: unknown, path: string, timestamp: string, correlationId: string) {
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let details: string[] | undefined;

    // In development, provide more details
    if (this.isDevelopment && exception instanceof Error) {
      message = exception.message || message;
      details = [exception.stack?.split('\n')[0] || exception.message];
    }

    return {
      statusCode: status,
      error: 'Internal Server Error',
      message,
      ...(details && { details }),
      timestamp,
      path,
      correlationId,
    };
  }

  /**
   * Log error details for debugging
   */
  private logError(exception: unknown, request: Request, correlationId: string, errorResponse: any) {
    const logContext = {
      correlationId,
      method: request.method,
      url: request.url,
      statusCode: errorResponse.statusCode,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: (request as any).user?.id,
    };

    // Log with appropriate level based on status code
    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `${errorResponse.message}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
        JSON.stringify(logContext, null, 2)
      );
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(
        `${errorResponse.message}`,
        JSON.stringify(logContext, null, 2)
      );
    } else {
      this.logger.log(
        `${errorResponse.message}`,
        JSON.stringify(logContext, null, 2)
      );
    }
  }

  /**
   * Type guard for Prisma errors
   */
  private isPrismaError(exception: unknown): boolean {
    return (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientRustPanicError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientValidationError
    );
  }

  /**
   * Type guard for YouTube API errors
   */
  private isYouTubeError(exception: unknown): boolean {
    if (!exception || typeof exception !== 'object') {
      return false;
    }

    const err = exception as any;
    
    // Check for custom YouTube error types
    if (err.name === 'YouTubeQuotaExceededError' || err.name === 'YouTubeRateLimitError') {
      return true;
    }

    // Check for YouTube API error response structure
    if (err.response?.data?.error?.errors?.[0]?.domain === 'youtube') {
      return true;
    }

    return false;
  }

  /**
   * Type guard for Multer file upload errors
   */
  private isMulterError(exception: unknown): boolean {
    if (!exception || typeof exception !== 'object') {
      return false;
    }

    const err = exception as any;
    
    // Multer errors have a 'code' property starting with 'LIMIT_'
    return typeof err.code === 'string' && err.code.startsWith('LIMIT_');
  }
}