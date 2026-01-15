import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoteReviewDto {
  @ApiProperty({ 
    description: 'True if helpful, false if not helpful',
    example: true 
  })
  @IsBoolean()
  isHelpful: boolean;
}
