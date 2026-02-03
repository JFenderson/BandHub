import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PlaylistCollaboratorRole {
  VIEWER = 'VIEWER',
  EDITOR = 'EDITOR',
  OWNER = 'OWNER',
}

export class AddCollaboratorDto {
  @ApiProperty({ description: 'User ID to add as collaborator' })
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    description: 'Collaborator role',
    enum: PlaylistCollaboratorRole,
    default: PlaylistCollaboratorRole.EDITOR,
  })
  @IsOptional()
  @IsEnum(PlaylistCollaboratorRole)
  role?: PlaylistCollaboratorRole;
}

export class UpdateCollaboratorDto {
  @ApiProperty({
    description: 'Collaborator role',
    enum: PlaylistCollaboratorRole,
  })
  @IsEnum(PlaylistCollaboratorRole)
  role: PlaylistCollaboratorRole;
}
