import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShareLinkDto {
  @ApiPropertyOptional({ description: 'Optional expiration date for the share link' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
