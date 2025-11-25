import { IsArray, ValidateNested, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class FeaturedOrderItem {
  @ApiProperty({ description: 'Band ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Featured order position (1-8)' })
  @IsInt()
  @Min(1)
  @Max(8)
  featuredOrder: number;
}

export class UpdateFeaturedOrderDto {
  @ApiProperty({
    description: 'Array of bands with their new featured order',
    type: [FeaturedOrderItem],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeaturedOrderItem)
  bands: FeaturedOrderItem[];
}
