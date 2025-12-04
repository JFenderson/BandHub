import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly client?: SESClient;
  private readonly from: string;

  constructor(private config: ConfigService) {
    const region = this.config.get<string>('AWS_REGION');
    this.from = this.config.get<string>('SES_FROM_EMAIL') || this.config.get<string>('EMAIL_FROM') || 'noreply@hbcubandhub.com';

    if (region) {
      // SESClient will pick up credentials from environment or IAM role if not provided explicitly
      this.client = new SESClient({ region });
      this.logger.log(`SES mailer initialized for region ${region}`);
    } else {
      this.client = undefined;
      this.logger.debug('SES not configured (AWS_REGION missing) — MailerService will be inactive');
    }
  }

  async sendMail(options: MailOptions): Promise<void> {
    if (!this.client) {
      this.logger.warn('SES client not configured — sendMail skipped');
      return;
    }

    const input: SendEmailCommandInput = {
      Destination: { ToAddresses: [options.to] },
      Message: {
        Body: {
          Html: { Charset: 'UTF-8', Data: options.html },
          ...(options.text ? { Text: { Charset: 'UTF-8', Data: options.text } } : {}),
        },
        Subject: { Charset: 'UTF-8', Data: options.subject },
      },
      Source: this.from,
    };

    try {
      const cmd = new SendEmailCommand(input);
      const res = await this.client.send(cmd);
      this.logger.log(`SES email sent to ${options.to} MessageId=${res.MessageId}`);
    } catch (err) {
      this.logger.error('Failed to send email via SES', err as any);
      throw err;
    }
  }
}
