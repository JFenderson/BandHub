import { PrismaClient } from '@prisma/client';

export class DatabaseService extends PrismaClient {
  constructor() {
    super();
  }

  async connect() {
    await this.$connect();
    console.log('✅ Worker connected to PostgreSQL');
  }

  async disconnect() {
    await this.$disconnect();
    console.log('❌ Worker disconnected from PostgreSQL');
  }
}