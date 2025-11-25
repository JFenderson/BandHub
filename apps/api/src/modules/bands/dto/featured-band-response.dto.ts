import { ApiProperty } from '@nestjs/swagger';

export class FeaturedBandVideoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  thumbnailUrl: string;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  viewCount: number;

  @ApiProperty()
  publishedAt: Date;
}

export class SchoolColorsDto {
  @ApiProperty()
  primary: string;

  @ApiProperty()
  secondary: string;
}

export class FeaturedBandResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  school: string;

  @ApiProperty({ required: false })
  description: string | null;

  @ApiProperty({ required: false })
  logoUrl: string | null;

  @ApiProperty()
  slug: string;

  @ApiProperty({ type: SchoolColorsDto, required: false })
  schoolColors?: SchoolColorsDto;

  @ApiProperty()
  videoCount: number;

  @ApiProperty({ type: [FeaturedBandVideoDto] })
  recentVideos: FeaturedBandVideoDto[];

  @ApiProperty()
  featuredOrder: number;

  @ApiProperty({ required: false })
  featuredSince: Date | null;
}

export class FeaturedBandsResponseDto {
  @ApiProperty({ type: [FeaturedBandResponseDto] })
  bands: FeaturedBandResponseDto[];
}

export class FeaturedBandRecommendationDto {
  @ApiProperty()
  band: any; // Using any for simplicity; in production, create a specific DTO

  @ApiProperty()
  score: number;

  @ApiProperty({ type: [String] })
  reasoning: string[];

  @ApiProperty({ required: false })
  suggestedAction?: string;
}

export class FeaturedRecommendationsResponseDto {
  @ApiProperty({ type: [FeaturedBandRecommendationDto] })
  recommendations: FeaturedBandRecommendationDto[];
}

export class FeaturedBandAnalyticsDto {
  @ApiProperty()
  bandId: string;

  @ApiProperty()
  bandName: string;

  @ApiProperty()
  totalClicks: number;

  @ApiProperty()
  clickThroughRate: number;

  @ApiProperty()
  averagePosition: number;

  @ApiProperty()
  daysFeatured: number;
}

export class FeaturedBandAnalyticsResponseDto {
  @ApiProperty({ type: [FeaturedBandAnalyticsDto] })
  analytics: FeaturedBandAnalyticsDto[];

  @ApiProperty()
  totalFeaturedClicks: number;

  @ApiProperty()
  averageCTR: number;

  @ApiProperty()
  bestPerformingPosition: number;
}
