import dotenv from 'dotenv';
import { getPrismaClient } from '../src/prisma-client';

// Load environment variables
dotenv.config();

const prisma = getPrismaClient();

async function resetSyncCursor() {
  try {
    console.log('Resetting transaction sync cursors for all access tokens...');
    
    const result = await prisma.accessToken.updateMany({
      data: {
        transactionSyncCursor: null,
      },
    });

    console.log(`✅ Successfully reset sync cursors for ${result.count} access token(s)`);
    console.log('You can now re-sync transactions from Plaid.');
  } catch (error) {
    console.error('Error resetting sync cursor:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetSyncCursor();
