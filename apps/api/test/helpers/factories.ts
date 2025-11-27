import { AdminRole, Prisma } from '@prisma/client';
import { SyncMode } from '@hbcu-band-hub/shared-types';

let counter = 0;
const next = () => ++counter;

export function buildBand(overrides: Partial<Prisma.BandCreateInput> = {}): Prisma.BandCreateInput {
  const id = next();
  return {
    name: overrides.name ?? `Test Band ${id}`,
    slug: overrides.slug ?? `test-band-${id}`,
    schoolName: overrides.schoolName ?? `School ${id}`,
    city: overrides.city ?? 'Cityville',
    state: overrides.state ?? 'State',
    conference: overrides.conference ?? 'SWAC',
    description: overrides.description ?? 'A marching band for testing.',
    foundedYear: overrides.foundedYear ?? 1900 + id,
    youtubeChannelId: overrides.youtubeChannelId ?? `channel-${id}`,
    youtubePlaylistIds: overrides.youtubePlaylistIds ?? [],
    isActive: overrides.isActive ?? true,
    isFeatured: overrides.isFeatured ?? false,
  };
}

export function buildVideo(overrides: Partial<Prisma.VideoCreateInput> = {}): Prisma.VideoCreateInput {
  const id = next();
  return {
    title: overrides.title ?? `Test Video ${id}`,
    description: overrides.description ?? 'A marching band video.',
    youtubeId: overrides.youtubeId ?? `youtube-${id}`,
    thumbnailUrl: overrides.thumbnailUrl ?? `https://example.com/${id}.jpg`,
    duration: overrides.duration ?? 120,
    publishedAt: overrides.publishedAt ?? new Date(),
    isHidden: overrides.isHidden ?? false,
    band: overrides.band ?? undefined as any,
    ...overrides,
  } as Prisma.VideoCreateInput;
}

export function buildAdminUser(overrides: Partial<Prisma.AdminUserCreateInput> = {}): Prisma.AdminUserCreateInput {
  const id = next();
  return {
    email: overrides.email ?? `user${id}@example.com`,
    name: overrides.name ?? `User ${id}`,
    passwordHash: overrides.passwordHash ?? `hash-${id}`,
    role: overrides.role ?? AdminRole.MODERATOR,
    ...overrides,
  };
}

export function buildSyncJob(overrides: Partial<{ bandId: string; mode: SyncMode }> = {}) {
  const id = next();
  return {
    bandId: overrides.bandId ?? `band-${id}`,
    mode: overrides.mode ?? SyncMode.FULL,
  };
}

export function createMockPagination<T>(items: T[], total: number, page = 1, limit = 10) {
  return {
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
