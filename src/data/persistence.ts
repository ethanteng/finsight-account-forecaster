import { getPrismaClient } from '../prisma-client';

const prisma = getPrismaClient();

/**
 * Persist Plaid transactions to database
 * Handles deduplication using plaidTransactionId
 */
export async function persistTransactionsToDb(
  userId: string,
  transactions: any[],
  accounts: any[]
): Promise<void> {
  try {
    console.log(`Persistence: Starting to persist ${transactions.length} transactions for user ${userId}`);
    
    // Create a map of Plaid account IDs to database account IDs
    const accountMap = new Map<string, string>();
    
    // First ensure all accounts exist in the database
    for (const account of accounts) {
      const plaidAccountId = account.account_id || account.plaidAccountId;
      
      if (!plaidAccountId) {
        continue;
      }

      try {
        const dbAccount = await prisma.account.upsert({
          where: { plaidAccountId },
          create: {
            plaidAccountId,
            name: account.name,
            type: account.type,
            subtype: account.subtype || null,
            mask: account.mask || null,
            officialName: account.official_name || account.officialName || null,
            currentBalance: account.balances?.current || account.balance?.current || 0,
            availableBalance: account.balances?.available || account.balance?.available || null,
            currency: account.balances?.iso_currency_code || account.currency || 'USD',
            institution: account.institution || null,
            userId,
            lastSynced: new Date(),
          },
          update: {
            name: account.name,
            currentBalance: account.balances?.current || account.balance?.current || 0,
            availableBalance: account.balances?.available || account.balance?.available || null,
            lastSynced: new Date(),
          },
        });

        accountMap.set(plaidAccountId, dbAccount.id);
      } catch (error) {
        console.error(`Error upserting account ${plaidAccountId}:`, error);
      }
    }

    // Now persist transactions
    let persistedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const transaction of transactions) {
      try {
        const plaidTransactionId = transaction.transaction_id || transaction.id;
        const plaidAccountId = transaction.account_id;

        if (!plaidTransactionId || !plaidAccountId) {
          skippedCount++;
          continue;
        }

        const dbAccountId = accountMap.get(plaidAccountId);
        if (!dbAccountId) {
          skippedCount++;
          continue;
        }

        const category = Array.isArray(transaction.category)
          ? transaction.category.join(', ')
          : transaction.category || null;

        // Check if transaction already exists
        const existing = await prisma.transaction.findUnique({
          where: { plaidTransactionId },
        });

        // Plaid sends amounts with reversed signs: income is negative, expenses are positive
        // Flip the sign so income is positive and expenses are negative (standard convention)
        const normalizedAmount = -transaction.amount;

        if (existing) {
          // Update existing transaction
          await prisma.transaction.update({
            where: { plaidTransactionId },
            data: {
              amount: normalizedAmount,
              date: new Date(transaction.date),
              name: transaction.name,
              category,
              pending: transaction.pending || false,
              merchantName: transaction.merchant_name || null,
              paymentChannel: transaction.payment_channel || null,
              authorizedDate: transaction.authorized_date ? new Date(transaction.authorized_date) : null,
              lastSynced: new Date(),
            },
          });
          updatedCount++;
        } else {
          // Create new transaction
          await prisma.transaction.create({
            data: {
              plaidTransactionId,
              accountId: dbAccountId,
              userId,
              amount: normalizedAmount,
              date: new Date(transaction.date),
              name: transaction.name,
              category,
              pending: transaction.pending || false,
              currency: transaction.iso_currency_code || transaction.currency || 'USD',
              merchantName: transaction.merchant_name || null,
              paymentChannel: transaction.payment_channel || null,
              authorizedDate: transaction.authorized_date ? new Date(transaction.authorized_date) : null,
              lastSynced: new Date(),
            },
          });
          persistedCount++;
        }
      } catch (error) {
        console.error(`Error persisting transaction:`, error);
        skippedCount++;
      }
    }
    
    console.log(`Persistence: Completed - ${persistedCount} created, ${updatedCount} updated, ${skippedCount} skipped`);
  } catch (error) {
    console.error('Persistence: Error persisting transactions:', error);
    throw error;
  }
}
