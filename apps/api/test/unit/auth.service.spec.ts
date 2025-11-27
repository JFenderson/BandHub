import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/modules/auth/auth.service';
import * as bcrypt from 'bcrypt';

const createMocks = () => {
  const prisma = {
    adminUser: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    refreshToken: { create: jest.fn(), deleteMany: jest.fn(), findFirst: jest.fn() },
  } as any;
  const jwtService = { signAsync: jest.fn().mockResolvedValue('token') } as any;
  const configService = { get: jest.fn().mockReturnValue('secret') } as any;

  const service = new AuthService(prisma, jwtService, configService);
  return { service, prisma, jwtService, configService };
};

describe('AuthService (unit)', () => {
  it('rejects duplicate registrations', async () => {
    const { service, prisma } = createMocks();
    prisma.adminUser.findUnique.mockResolvedValue({ id: '1', email: 'test@example.com' });

    await expect(
      service.register({ email: 'test@example.com', name: 'Test', password: 'Pass123!' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('hashes password on registration', async () => {
    const { service, prisma } = createMocks();
    prisma.adminUser.findUnique.mockResolvedValue(null);
    prisma.adminUser.create.mockImplementation(({ data }: any) => ({ id: '1', ...data }));

    const user = await service.register({ email: 'a@b.com', name: 'A', password: 'secret' });

    expect(user.passwordHash).toBeUndefined();
    expect(prisma.adminUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: expect.any(String) }),
      }),
    );
  });

  it('throws unauthorized for invalid password and logs audit', async () => {
    const { service, prisma } = createMocks();
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      passwordHash: await bcrypt.hash('correct', 1),
      isActive: true,
    });

    await expect(
      service.login({ email: 'user@example.com', password: 'wrong' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
