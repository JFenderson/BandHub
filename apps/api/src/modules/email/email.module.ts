import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { MailerModule } from '../mailer/mailer.module';

@Global()
@Module({
  imports: [ConfigModule, MailerModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
