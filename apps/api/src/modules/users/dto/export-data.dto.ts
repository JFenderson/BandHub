import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';

export class ExportDataDto {
  @ApiProperty({
    description: 'Export format',
    enum: ['json', 'csv'],
    example: 'json',
    required: false,
    default: 'json',
  })
  @IsOptional()
  @IsEnum(['json', 'csv'], { message: 'Format must be json or csv' })
  format?: 'json' | 'csv';
}
