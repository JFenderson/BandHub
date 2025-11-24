import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly appUrl: string;

  constructor(private configService: ConfigService) {
    this.fromEmail = configService.get<string>('EMAIL_FROM') || 'noreply@hbcubandhub.com';
    this.appUrl = configService.get<string>('APP_URL') || 'http://localhost:3000';
  }

  /**
   * Send an email (using console logging in development, or email service in production)
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    
    if (resendApiKey) {
      // Use Resend in production
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.fromEmail,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to send email: ${JSON.stringify(error)}`);
        }

        this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
      } catch (error) {
        this.logger.error(`Failed to send email to ${options.to}:`, error);
        throw error;
      }
    } else {
      // Log email in development
      this.logger.log(`[DEV] Email to ${options.to}:`);
      this.logger.log(`Subject: ${options.subject}`);
      this.logger.log(`Body: ${options.text || options.html}`);
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const html = this.getWelcomeTemplate(name);
    await this.sendEmail({
      to: email,
      subject: 'Welcome to HBCU Band Hub!',
      html,
      text: `Welcome to HBCU Band Hub, ${name}! We're excited to have you join our community.`,
    });
  }

  /**
   * Send email verification link
   */
  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const verifyUrl = `${this.appUrl}/verify-email/${token}`;
    const html = this.getVerificationTemplate(name, verifyUrl);
    await this.sendEmail({
      to: email,
      subject: 'Verify your HBCU Band Hub account',
      html,
      text: `Hi ${name}, please verify your email by clicking this link: ${verifyUrl}`,
    });
  }

  /**
   * Send password reset link
   */
  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password/${token}`;
    const html = this.getPasswordResetTemplate(name, resetUrl);
    await this.sendEmail({
      to: email,
      subject: 'Reset your HBCU Band Hub password',
      html,
      text: `Hi ${name}, you requested a password reset. Click this link to reset your password: ${resetUrl}. If you didn't request this, you can ignore this email.`,
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
      text: `Hi ${name}, your password has been successfully changed. If you didn't make this change, please contact support immediately.`,
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
      text: `Hi ${name}, your HBCU Band Hub account has been deleted. We're sorry to see you go!`,
    });
  }

  // ============ EMAIL TEMPLATES ============

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
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; background: linear-gradient(135deg, #dc2626 0%, #7c2d12 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">HBCU Band Hub</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                © ${new Date().getFullYear()} HBCU Band Hub. All rights reserved.
              </p>
              <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">
                Celebrating the excellence of HBCU marching bands
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

  private getWelcomeTemplate(name: string): string {
    return this.getBaseTemplate(`
      <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Welcome, ${name}!</h2>
      <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
        Thank you for joining HBCU Band Hub! We're thrilled to have you as part of our community celebrating the excellence of HBCU marching bands.
      </p>
      <p style="margin: 0 0 24px; color: #374151; line-height: 1.6;">
        With your account, you can:
      </p>
      <ul style="margin: 0 0 24px; padding-left: 20px; color: #374151; line-height: 1.8;">
        <li>Browse videos from your favorite HBCU bands</li>
        <li>Save your favorite performances</li>
        <li>Customize your viewing preferences</li>
        <li>Stay updated on new content</li>
      </ul>
      <a href="${this.appUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Start Exploring
      </a>
    `);
  }

  private getVerificationTemplate(name: string, verifyUrl: string): string {
    return this.getBaseTemplate(`
      <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Verify Your Email</h2>
      <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
        Hi ${name}, please click the button below to verify your email address.
      </p>
      <p style="margin: 0 0 24px; color: #374151; line-height: 1.6;">
        This link will expire in 24 hours.
      </p>
      <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Verify Email
      </a>
      <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">
        If you didn't create an account, you can safely ignore this email.
      </p>
    `);
  }

  private getPasswordResetTemplate(name: string, resetUrl: string): string {
    return this.getBaseTemplate(`
      <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Reset Your Password</h2>
      <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
        Hi ${name}, we received a request to reset your password.
      </p>
      <p style="margin: 0 0 24px; color: #374151; line-height: 1.6;">
        Click the button below to create a new password. This link will expire in 1 hour.
      </p>
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Reset Password
      </a>
      <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    `);
  }

  private getPasswordChangedTemplate(name: string): string {
    return this.getBaseTemplate(`
      <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Password Changed</h2>
      <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
        Hi ${name}, your password has been successfully changed.
      </p>
      <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
        If you made this change, no further action is needed.
      </p>
      <p style="margin: 0; color: #dc2626; font-weight: 500;">
        If you didn't make this change, please contact support immediately.
      </p>
    `);
  }

  private getAccountDeletedTemplate(name: string): string {
    return this.getBaseTemplate(`
      <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Account Deleted</h2>
      <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
        Hi ${name}, your HBCU Band Hub account has been successfully deleted.
      </p>
      <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
        We're sorry to see you go! All your data has been permanently removed from our systems.
      </p>
      <p style="margin: 0; color: #374151; line-height: 1.6;">
        If you ever want to come back, you can create a new account at any time.
      </p>
    `);
  }
}
