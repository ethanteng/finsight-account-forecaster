import dotenv from 'dotenv';
import { getPrismaClient } from '../src/prisma-client';

// Load environment variables
dotenv.config();

const prisma = getPrismaClient();

async function deleteAllTransactions() {
  try {
    console.log('Deleting all recurring patterns...');
    const deletedPatterns = await prisma.recurringPattern.deleteMany({});
    console.log(`Deleted ${deletedPatterns.count} recurring patterns`);

    console.log('Deleting all forecast transactions...');
    const deletedForecastTransactions = await prisma.forecastTransaction.deleteMany({});
    console.log(`Deleted ${deletedForecastTransactions.count} forecast transactions`);

    console.log('Deleting all forecasts...');
    const deletedForecasts = await prisma.forecast.deleteMany({});
    console.log(`Deleted ${deletedForecasts.count} forecasts`);

    console.log('Deleting all transactions...');
    const deletedTransactions = await prisma.transaction.deleteMany({});
    console.log(`Deleted ${deletedTransactions.count} transactions`);

    console.log('\n✅ Successfully deleted all transactions and related data!');
    console.log('You can now re-sync transactions from Plaid with the corrected signs.');
  } catch (error) {
    console.error('Error deleting transactions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllTransactions();
