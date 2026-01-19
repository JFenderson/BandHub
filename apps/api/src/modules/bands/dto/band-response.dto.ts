import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

// Response DTOs are just for Swagger documentation
// They describe the shape of responses, not validated input
export class BandResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  schoolName!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  state!: string;

  @ApiPropertyOptional()
  conference!: string | null;

  @ApiPropertyOptional()
  logoUrl!: string | null;

  @ApiPropertyOptional()
  bannerUrl!: string | null;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiPropertyOptional()
  foundedYear!: number | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  isFeatured!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @Expose()
  primaryColor?: string;

  @Expose()
  secondaryColor?: string;
}

export class BandWithVideoCountDto extends BandResponseDto {
  @ApiProperty()
  videoCount!: number;
}