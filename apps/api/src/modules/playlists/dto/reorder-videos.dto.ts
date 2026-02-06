import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderVideosDto {
  @ApiProperty({
    description: 'Array of video IDs in the desired order',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  videoIds: string[];
}
