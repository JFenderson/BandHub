import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum QueueAction {
  PAUSE = 'PAUSE',
  RESUME = 'RESUME',
  CLEAR_FAILED = 'CLEAR_FAILED',
}

export class QueueActionDto {
  @ApiProperty({ description: 'Queue action to perform', enum: QueueAction })
  @IsEnum(QueueAction)
  action: QueueAction;
}
