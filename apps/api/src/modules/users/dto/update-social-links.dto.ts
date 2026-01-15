import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUrl } from 'class-validator';

export class UpdateSocialLinksDto {
  @ApiProperty({
    description: 'Twitter profile URL',
    example: 'https://twitter.com/username',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Twitter must be a valid URL' })
  twitter?: string;

  @ApiProperty({
    description: 'Instagram profile URL',
    example: 'https://instagram.com/username',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Instagram must be a valid URL' })
  instagram?: string;

  @ApiProperty({
    description: 'Facebook profile URL',
    example: 'https://facebook.com/username',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Facebook must be a valid URL' })
  facebook?: string;

  @ApiProperty({
    description: 'YouTube channel URL',
    example: 'https://youtube.com/c/channelname',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'YouTube must be a valid URL' })
  youtube?: string;

  @ApiProperty({
    description: 'Personal website URL',
    example: 'https://example.com',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Website must be a valid URL' })
  website?: string;
}
