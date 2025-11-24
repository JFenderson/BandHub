import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function createApiKey() {
  const name = process.argv[2] || 'Worker Service';
  const description = process.argv[3] || 'API key for background worker service';
  const expiresInDays = process.argv[4] ? parseInt(process.argv[4]) : null;

  const key = `bhub_live_${randomBytes(32).toString('hex')}`;

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const apiKey = await prisma.apiKey.create({
    data: {
      key,
      name,
      description,
      expiresAt,
    },
  });

  console.log('\n✅ API Key created successfully!\n');
  console.log('ID:', apiKey.id);
  console.log('Name:', apiKey.name);
  console.log('Key:', apiKey.key);
  console.log('Expires:', apiKey.expiresAt || 'Never');
  console.log('\n⚠️  Store this key securely - it won\'t be shown again!\n');
  console.log('Add to your worker .env file:');
  console.log(`API_KEY=${apiKey.key}\n`);

  await prisma.$disconnect();
}

createApiKey().catch((error) => {
  console.error('Error creating API key:', error);
  process.exit(1);
});