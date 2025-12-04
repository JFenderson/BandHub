import { ConfigService } from '@nestjs/config';
import { MailerService } from './mailer.service';

describe('MailerService', () => {
  it('does not throw when SES is not configured', async () => {
    const mockConfig = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    const svc = new MailerService(mockConfig);

    await expect(
      svc.sendMail({ to: 'test@example.com', subject: 'hi', html: '<p>hello</p>' }),
    ).resolves.toBeUndefined();
  });
});
