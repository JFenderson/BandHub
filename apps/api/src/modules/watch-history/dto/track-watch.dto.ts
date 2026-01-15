import { IsString, IsInt, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TrackWatchDto {
  @ApiProperty({ description: 'Video ID to track' })
  @IsString()
  videoId: string;

  @ApiProperty({ description: 'Watch duration in seconds', minimum: 0 })
  @IsInt()
  @Min(0)
  watchDuration: number;

  @ApiProperty({ description: 'Whether the video was completed' })
  @IsBoolean()
  completed: boolean;
}
