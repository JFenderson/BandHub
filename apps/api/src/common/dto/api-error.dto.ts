import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ example: 400, description: 'HTTP Status Code' })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request', description: 'Error type' })
  error: string;

  @ApiProperty({ 
    example: ['email must be an email', 'password must be longer than 8 characters'],
    description: 'Detailed error messages' 
  })
  message: string | string[];

  @ApiProperty({ example: '2024-01-01T12:00:00.000Z', description: 'Timestamp of error' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/auth/login', description: 'Path where error occurred' })
  path: string;
}