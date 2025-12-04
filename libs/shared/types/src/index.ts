export * from './queue.types';
// export * from './video-categories';
export * from './constants';
// Export all band types
export * from './band';
export * from './video';
export * from './event';


export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}