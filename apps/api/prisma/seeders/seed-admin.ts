import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function seedAdmin(prisma: PrismaClient) {
  const email = 'admin@bandhub.com';
  const password = 'SecurePass123!';
  
  console.log('🔐 Seeding admin user...\n');
  
  const passwordHash = await bcrypt.hash(password, 10);
  
  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      name: 'Admin User',
      role: 'ADMIN',
      isActive: true,
    },
  });
  
  console.log('✅ Admin user created/updated:', admin.email);
  console.log('📧 Email:', email);
  console.log('🔑 Password:', password);
  console.log('\nYou can now login at /admin/login');
}

seedAdmin(prisma)
  .catch((error) => {
    console.error('❌ Error seeding admin user:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
