import { IsInt, IsString, IsNotEmpty, Min, Max, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ 
    description: 'Rating from 1 to 5', 
    minimum: 1, 
    maximum: 5,
    example: 5 
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ 
    description: 'Review title', 
    maxLength: 100,
    example: 'Amazing performance!' 
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title?: string;

  @ApiProperty({ 
    description: 'Review content', 
    minLength: 10,
    maxLength: 2000,
    example: 'The band delivered an incredible performance. The precision and energy were outstanding!' 
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  content: string;
}
