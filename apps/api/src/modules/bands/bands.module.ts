import { Module } from '@nestjs/common';
import { BandsController } from './bands.controller';
import { BandsService } from './bands.service';
import { BandsRepository } from './bands.repository';

@Module({
  controllers: [BandsController],
  providers: [BandsService, BandsRepository],
  exports: [BandsService], // Other modules can use BandsService
})
export class BandsModule {}