import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../mailer/mailer.service';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?:  string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private fromEmail:  string;
  private fromName:  string;
  private appUrl: string;

  constructor(
    private configService: ConfigService,
    @Optional() private mailer?:  MailerService,
  ) {
    this.fromEmail = configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME', 'HBCU Band Hub');
    this.appUrl = configService.get<string>('APP_URL') || 'http://localhost:3000';
  }

  /**
   * Send an email using Resend API or log in development
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const skipEmail = this.configService.get<string>('EMAIL_SKIP_SEND') === 'true';

    // In development or when EMAIL_SKIP_SEND is true, just log emails
    if (nodeEnv === 'development' || skipEmail) {
      this.logger.warn(`📧 [DEV MODE] Email sending skipped in ${nodeEnv} environment`);
      this.logger.log(`📧 [DEV MODE] Would send to: ${options.to}`);
      this.logger.log(`📧 Subject: ${options.subject}`);

      // Extract token from verification URL for easy testing
      if (options.html.includes('verify-email')) {
        const tokenMatch = options.html.match(/verify-email\/([^"<]+)/);
        if (tokenMatch) {
          this.logger.log(`📧 Verification URL: ${this.appUrl}/verify-email/${tokenMatch[1]}`);
        }
      }

      // Extract token from password reset URL for easy testing
      if (options.html.includes('reset-password')) {
        const tokenMatch = options.html.match(/reset-password\/([^"<]+)/);
        if (tokenMatch) {
          this.logger.log(`📧 Password Reset URL: ${this.appUrl}/reset-password/${tokenMatch[1]}`);
        }
      }

      this.logger.debug(`📧 Preview: ${options.text?.substring(0, 150) || 'HTML email'}`);
      return;
    }

    // Try Resend API if key is configured
    if (resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers:  {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${this.fromName} <${this.fromEmail}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          this.logger.error(`❌ Resend API error: ${JSON.stringify(error)}`);
          throw new Error(`Failed to send email: ${JSON.stringify(error)}`);
        }

        const result = await response.json();
        this.logger.log(`✅ Email sent via Resend to ${options.to}:  ${options.subject} (ID: ${result.id})`);
        return;
      } catch (error) {
        this.logger. error(`❌ Failed to send email via Resend: `, error);
        throw error;
      }
    } else {
      // Production without API key - this is a configuration error
      this.logger.error(`❌ RESEND_API_KEY not configured in production - email NOT sent to ${options.to}`);
      throw new Error('Email service not configured: RESEND_API_KEY is required in production');
    }
  }

  /**
   * Send email verification link
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${this.appUrl}/verify-email/${token}`;
    const html = this.getVerificationEmailTemplate(verificationUrl);

    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email - HBCU Band Hub',
      html,
      text: `Please verify your email by clicking this link: ${verificationUrl}`,
    });
  }

  /**
   * Send password reset link
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password/${token}`;
    const html = this.getPasswordResetEmailTemplate(resetUrl);

    await this.sendEmail({
      to: email,
      subject: 'Reset Your Password - HBCU Band Hub',
      html,
      text: `Reset your password by clicking this link: ${resetUrl}`,
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, displayName: string): Promise<void> {
    const html = this.getWelcomeEmailTemplate(displayName);

    await this.sendEmail({
      to: email,
      subject: 'Welcome to HBCU Band Hub!  🎺',
      html,
      text: `Welcome to HBCU Band Hub, ${displayName}! We're excited to have you join our community.`,
    });
  }

  /**
   * Send admin password reset link
   */
  async sendAdminPasswordResetEmail(email:  string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/admin/reset-password/${token}`;
    const html = this.getPasswordResetTemplate(name, resetUrl);
    await this.sendEmail({
      to: email,
      subject: 'Reset your HBCU Band Hub admin password',
      html,
      text: `Hi ${name}, you requested a password reset.  Click this link to reset your admin password: ${resetUrl}`,
    });
  }

  /**
   * Send password changed confirmation
   */
  async sendPasswordChangedEmail(email: string, name: string): Promise<void> {
    const html = this.getPasswordChangedTemplate(name);
    await this.sendEmail({
      to: email,
      subject: 'Your HBCU Band Hub password has been changed',
      html,
      text: `Hi ${name}, your password has been successfully changed.`,
    });
  }

  /**
   * Send account deletion confirmation
   */
  async sendAccountDeletedEmail(email: string, name: string): Promise<void> {
    const html = this.getAccountDeletedTemplate(name);
    await this.sendEmail({
      to: email,
      subject: 'Your HBCU Band Hub account has been deleted',
      html,
      text: `Hi ${name}, your HBCU Band Hub account has been deleted.`,
    });
  }

  /**
   * Send new video notification email
   */
  async sendNewVideoNotificationEmail(
    email: string,
    name: string,
    bandName:  string,
    videoTitle: string,
    videoId: string,
    thumbnailUrl: string,
  ): Promise<void> {
    const videoUrl = `${this.appUrl}/videos/${videoId}`;
    const html = this.getNewVideoNotificationTemplate(name, bandName, videoTitle, videoUrl, thumbnailUrl);
    await this.sendEmail({
      to: email,
      subject: `New video from ${bandName}`,
      html,
      text: `Hi ${name}, ${bandName} just posted a new video:  ${videoTitle}.  Watch it now: ${videoUrl}`,
    });
  }

  /**
   * Send weekly digest email
   */
  async sendWeeklyDigestEmail(
    email: string,
    name:  string,
    videos: Array<{
      id:  string;
      title: string;
      bandName: string;
      thumbnailUrl: string;
    }>,
  ): Promise<void> {
    const html = this.getWeeklyDigestTemplate(name, videos);
    await this.sendEmail({
      to: email,
      subject: 'Your weekly HBCU Band Hub digest',
      html,
      text:  `Hi ${name}, here's your weekly digest of ${videos.length} new videos from bands you follow.`,
    });
  }

  /**
   * Send upcoming event notification email
   */
  async sendUpcomingEventEmail(
    email: string,
    name: string,
    eventName: string,
    bandName: string,
    eventDate: Date,
    bandId:  string,
  ): Promise<void> {
    const bandUrl = `${this.appUrl}/bands/${bandId}`;
    const html = this.getUpcomingEventTemplate(name, eventName, bandName, eventDate, bandUrl);
    await this.sendEmail({
      to: email,
      subject: `Upcoming:  ${eventName}`,
      html,
      text: `Hi ${name}, ${bandName} will be performing at ${eventName} on ${eventDate.toLocaleDateString()}.`,
    });
  }

  // ============ EMAIL TEMPLATES ============

  private getVerificationEmailTemplate(verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 30px; background:  #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎺 Welcome to HBCU Band Hub! </h1>
            </div>
            <div class="content">
              <h2>Verify Your Email Address</h2>
              <p>Thanks for signing up!  Please verify your email address to get started.</p>
              <p>Click the button below to verify your email:</p>
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
              <p>Or copy and paste this link into your browser: </p>
              <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                This link will expire in 24 hours.  If you didn't create an account, you can safely ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} HBCU Band Hub. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordResetEmailTemplate(resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding:  30px; border-radius:  0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Reset Your Password</h2>
              <p>We received a request to reset your password.  Click the button below to create a new password:</p>
              <a href="${resetUrl}" class="button">Reset Password</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break:  break-all; color: #667eea;">${resetUrl}</p>
              <p style="margin-top: 30px; color: #666; font-size:  14px;">
                This link will expire in 1 hour.  If you didn't request a password reset, you can safely ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} HBCU Band Hub. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(displayName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height:  1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎺 Welcome to HBCU Band Hub!</h1>
            </div>
            <div class="content">
              <h2>Hey ${displayName}!  👋</h2>
              <p>Your email has been verified and your account is ready to go!</p>
              <p>Here's what you can do now:</p>
              <ul>
                <li>🎥 Watch amazing HBCU band performances</li>
                <li>📺 Create playlists of your favorite videos</li>
                <li>⭐ Favorite videos and bands</li>
                <li>👥 Follow other users and bands</li>
                <li>💬 Comment and engage with the community</li>
              </ul>
              <a href="${this.appUrl}" class="button">Start Exploring</a>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} HBCU Band Hub. All rights reserved. </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getBaseTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HBCU Band Hub</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse:  collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 40px; background:  linear-gradient(135deg, #dc2626 0%, #7c2d12 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">HBCU Band Hub</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                © ${new Date().getFullYear()} HBCU Band Hub. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private getPasswordResetTemplate(name: string, resetUrl: string): string {
    return this.getBaseTemplate(`
      <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Reset Your Password</h2>
      <p style="margin: 0 0 16px; color:  #374151; line-height: 1.6;">
        Hi ${name}, we received a request to reset your password. 
      </p>
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: #ffffff; text-decoration:  none; border-radius: 6px; font-weight: 500;">
        Reset Password
      </a>
    `);
  }

  private getPasswordChangedTemplate(name: string): string {
    return this.getBaseTemplate(`
      <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Password Changed</h2>
      <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
        Hi ${name}, your password has been successfully changed.
      </p>
    `);
  }

  private getAccountDeletedTemplate(name: string): string {
    return this.getBaseTemplate(`
      <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Account Deleted</h2>
      <p style="margin:  0 0 16px; color: #374151; line-height: 1.6;">
        Hi ${name}, your HBCU Band Hub account has been successfully deleted.
      </p>
    `);
  }

  private getNewVideoNotificationTemplate(
    name: string,
    bandName: string,
    videoTitle: string,
    videoUrl: string,
    thumbnailUrl: string,
  ): string {
    return this.getBaseTemplate(`
      <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">New Video from ${bandName}</h2>
      <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
        Hi ${name}, ${bandName} just posted a new video! 
      </p>
      <div style="margin: 0 0 24px;">
        <img src="${thumbnailUrl}" alt="${videoTitle}" style="width: 100%; border-radius: 8px;" />
      </div>
      <a href="${videoUrl}" style="display:  inline-block; padding: 12px 24px; background-color: #dc2626; color:  #ffffff; text-decoration: none; border-radius: 6px;">
        Watch Now
      </a>
    `);
  }

  private getWeeklyDigestTemplate(
    name: string,
    videos: Array<{
      id:  string;
      title: string;
      bandName: string;
      thumbnailUrl: string;
    }>,
  ): string {
    const videosList = videos
      .map(
        (v) => `
      <div style="margin-bottom: 16px;">
        <img src="${v.thumbnailUrl}" alt="${v.title}" style="width: 100%; border-radius: 4px;" />
        <p style="margin: 8px 0 0; font-weight: 500;">${v.title}</p>
        <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">${v.bandName}</p>
      </div>
    `,
      )
      .join('');

    return this.getBaseTemplate(`
      <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Your Weekly Digest</h2>
      <p style="margin: 0 0 24px; color: #374151; line-height: 1.6;">
        Hi ${name}, here's what's new from the bands you follow this week! 
      </p>
      ${videosList}
    `);
  }

  private getUpcomingEventTemplate(
    name:  string,
    eventName: string,
    bandName: string,
    eventDate: Date,
    bandUrl: string,
  ): string {
    return this.getBaseTemplate(`
      <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Upcoming Event</h2>
      <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
        Hi ${name}, ${bandName} will be performing at ${eventName} on ${eventDate.toLocaleDateString()}.
      </p>
      <a href="${bandUrl}" style="display: inline-block; padding:  12px 24px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px;">
        View Band Page
      </a>
    `);
  }
}