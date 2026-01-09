import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@bandhub/database';
import * as crypto from 'crypto';

// TOTP configuration
const TOTP_PERIOD = 30; // 30 seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'SHA1';
const BACKUP_CODES_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

@Injectable()
export class MfaService {
  private readonly encryptionKey: Buffer;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Get encryption key from environment or generate a warning
    const key = this.configService.get<string>('MFA_ENCRYPTION_KEY');
    if (!key) {
      console.warn(
        'MFA_ENCRYPTION_KEY not set. Using derived key from JWT_SECRET.',
      );
      const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'default-secret';
      this.encryptionKey = crypto
        .createHash('sha256')
        .update(jwtSecret)
        .digest();
    } else {
      this.encryptionKey = Buffer.from(key, 'hex');
    }
  }

  /**
   * Generate a new TOTP secret for a user
   */
  async generateSecret(userId: string): Promise<{
    secret: string;
    otpauthUrl: string;
    qrCodeDataUrl: string;
  }> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled for this account');
    }

    // Generate a random 20-byte secret (160 bits)
    const secretBytes = crypto.randomBytes(20);
    const secret = this.base32Encode(secretBytes);

    // Create the otpauth URL
    const issuer = this.configService.get<string>('APP_NAME') || 'BandHub';
    const accountName = encodeURIComponent(user.email);
    const encodedIssuer = encodeURIComponent(issuer);
    const otpauthUrl = `otpauth://totp/${encodedIssuer}:${accountName}?secret=${secret}&issuer=${encodedIssuer}&algorithm=${TOTP_ALGORITHM}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;

    // Generate QR code data URL using simple SVG-based approach
    const qrCodeDataUrl = await this.generateQrCodeDataUrl(otpauthUrl);

    // Store the encrypted secret temporarily (not enabled yet)
    const encryptedSecret = this.encryptSecret(secret);
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
        // Don't enable MFA yet - wait for verification
      },
    });

    return {
      secret, // Return plain secret for manual entry
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  /**
   * Verify TOTP and enable MFA for user
   */
  async enableMfa(
    userId: string,
    token: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    if (!user.mfaSecret) {
      throw new BadRequestException(
        'MFA setup not initiated. Please generate a secret first.',
      );
    }

    // Decrypt the secret and verify the token
    const secret = this.decryptSecret(user.mfaSecret);
    const isValid = this.verifyToken(secret, token);

    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = backupCodes.map((code) => this.hashBackupCode(code));

    // Enable MFA
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaEnabledAt: new Date(),
        mfaBackupCodes: hashedBackupCodes,
      },
    });

    return { backupCodes };
  }

  /**
   * Verify a TOTP token during login
   */
  async verifyMfaToken(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    // First try TOTP verification
    const secret = this.decryptSecret(user.mfaSecret);
    if (this.verifyToken(secret, token)) {
      return true;
    }

    // If TOTP fails, try backup code
    return this.verifyBackupCode(userId, token);
  }

  /**
   * Verify a backup code and mark it as used
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaBackupCodes?.length) {
      return false;
    }

    const hashedCode = this.hashBackupCode(code.toUpperCase().replace(/-/g, ''));
    const codeIndex = user.mfaBackupCodes.findIndex((c) => c === hashedCode);

    if (codeIndex === -1) {
      return false;
    }

    // Remove the used backup code
    const updatedCodes = [...user.mfaBackupCodes];
    updatedCodes.splice(codeIndex, 1);

    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { mfaBackupCodes: updatedCodes },
    });

    return true;
  }

  /**
   * Disable MFA for a user
   */
  async disableMfa(userId: string, token: string): Promise<void> {
    // Verify current token before disabling
    const isValid = await this.verifyMfaToken(userId, token);
    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        mfaEnabledAt: null,
      },
    });
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(
    userId: string,
    token: string,
  ): Promise<{ backupCodes: string[] }> {
    // Verify current token
    const isValid = await this.verifyMfaToken(userId, token);
    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = backupCodes.map((code) => this.hashBackupCode(code));

    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { mfaBackupCodes: hashedBackupCodes },
    });

    return { backupCodes };
  }

  /**
   * Check if MFA is enabled for a user
   */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    return user?.mfaEnabled || false;
  }

  /**
   * Get remaining backup codes count
   */
  async getBackupCodesCount(userId: string): Promise<number> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      select: { mfaBackupCodes: true },
    });

    return user?.mfaBackupCodes?.length || 0;
  }

  // ============ PRIVATE HELPER METHODS ============

  /**
   * Generate TOTP token from secret
   */
  private generateTotpToken(secret: string, timestamp?: number): string {
    const time = timestamp || Math.floor(Date.now() / 1000);
    const counter = Math.floor(time / TOTP_PERIOD);

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const secretBuffer = this.base32Decode(secret);
    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0xf;
    const code =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    return (code % Math.pow(10, TOTP_DIGITS)).toString().padStart(TOTP_DIGITS, '0');
  }

  /**
   * Verify a TOTP token (with time window)
   */
  private verifyToken(secret: string, token: string): boolean {
    const time = Math.floor(Date.now() / 1000);

    // Check current, previous, and next time periods
    for (let i = -1; i <= 1; i++) {
      const checkTime = time + i * TOTP_PERIOD;
      const expectedToken = this.generateTotpToken(secret, checkTime);
      if (token === expectedToken) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
      const code = crypto
        .randomBytes(BACKUP_CODE_LENGTH / 2)
        .toString('hex')
        .toUpperCase();
      // Format as XXXX-XXXX
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    return codes;
  }

  /**
   * Hash a backup code for storage
   */
  private hashBackupCode(code: string): string {
    return crypto
      .createHash('sha256')
      .update(code.toUpperCase().replace(/-/g, ''))
      .digest('hex');
  }

  /**
   * Encrypt the TOTP secret for storage
   */
  private encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt the stored TOTP secret
   */
  private decryptSecret(encryptedSecret: string): string {
    const [ivHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Base32 encode bytes
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 0x1f];
        bits -= 5;
      }
    }

    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 0x1f];
    }

    return result;
  }

  /**
   * Base32 decode string to bytes
   */
  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanedInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');

    const output: number[] = [];
    let bits = 0;
    let value = 0;

    for (const char of cleanedInput) {
      const index = alphabet.indexOf(char);
      if (index === -1) continue;

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }

  /**
   * Generate a simple QR code data URL
   * This is a simplified implementation - in production, use a library like 'qrcode'
   */
  private async generateQrCodeDataUrl(data: string): Promise<string> {
    // For now, return a placeholder that indicates QR should be generated client-side
    // In production, install 'qrcode' package and use:
    // const QRCode = require('qrcode');
    // return await QRCode.toDataURL(data);
    
    // Return the otpauth URL encoded for client-side QR generation
    return `data:text/plain;base64,${Buffer.from(data).toString('base64')}`;
  }
}
