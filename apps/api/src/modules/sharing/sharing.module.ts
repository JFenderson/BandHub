import { Module } from '@nestjs/common';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';
import { PrismaModule } from '@bandhub/database';
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [SharingController],
  providers: [SharingService, OptionalAuthGuard],
  exports: [SharingService],
})
export class SharingModule {}
