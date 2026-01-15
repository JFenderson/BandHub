import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LikeCommentDto {
  @ApiProperty({ description: 'True for like, false for dislike' })
  @IsBoolean()
  isLike: boolean;
}
