import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VideoDetailDto {
  @ApiProperty({ description: 'Video ID' })
  id: string;

  @ApiProperty({ description: 'YouTube video ID' })
  youtubeId: string;

  @ApiProperty({ description: 'Video title' })
  title: string;

  @ApiPropertyOptional({ description: 'Video description' })
  description?: string;

  @ApiProperty({ description: 'Thumbnail URL' })
  thumbnailUrl: string;

  @ApiProperty({ description: 'Video duration in seconds' })
  duration: number;

  @ApiProperty({ description: 'Published date' })
  publishedAt: Date;

  @ApiProperty({ description: 'View count' })
  viewCount: number;

  @ApiProperty({ description: 'Like count' })
  likeCount: number;

  @ApiPropertyOptional({ description: 'Event name' })
  eventName?: string;

  @ApiPropertyOptional({ description: 'Event year' })
  eventYear?: number;

  @ApiProperty({ description: 'Video tags', type: [String] })
  tags: string[];

  @ApiProperty({ description: 'Is video hidden' })
  isHidden: boolean;

  @ApiPropertyOptional({ description: 'Hide reason' })
  hideReason?: string;

  @ApiProperty({ description: 'Quality score (0-100)' })
  qualityScore: number;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Band information' })
  band: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };

  @ApiPropertyOptional({ description: 'Category information' })
  category?: {
    id: string;
    name: string;
    slug: string;
  };

  @ApiPropertyOptional({ description: 'Opponent band information' })
  opponentBand?: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
}
