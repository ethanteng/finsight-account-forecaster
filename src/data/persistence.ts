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
          // Preserve user-edited transaction name
          // Strategy: If the current name differs from what Plaid is sending,
          // and we have an originalDescription that matches Plaid's name,
          // then the user must have edited it - preserve the current name.
          // Otherwise, update to Plaid's name.
          const plaidName = transaction.name;
          const currentName = existing.name;
          const originalDesc = existing.originalDescription;
          
          // Determine if name was edited by user:
          // 1. If originalDescription exists and matches Plaid name, but current name differs -> edited
          // 2. If originalDescription is null (old transaction), be conservative:
          //    - If current name differs from Plaid name AND from merchantName, likely edited -> preserve
          //    - Otherwise, update to Plaid name and set originalDescription
          let preserveName = false;
          
          if (originalDesc !== null && originalDesc !== undefined) {
            // We have original description - if current name differs from both Plaid and original, it was edited
            preserveName = currentName !== plaidName && currentName !== originalDesc;
          } else {
            // No original description (old transaction) - be conservative
            // If name differs significantly from Plaid name and merchant name, likely edited
            const merchantName = existing.merchantName || '';
            const nameDiffersFromPlaid = currentName !== plaidName;
            const nameDiffersFromMerchant = currentName.toLowerCase().trim() !== merchantName.toLowerCase().trim();
            
            // If name differs from both Plaid and merchant, and it's not just a minor variation, preserve it
            if (nameDiffersFromPlaid && nameDiffersFromMerchant && merchantName) {
              preserveName = true;
            }
          }
          
          // Update existing transaction, preserving user-edited name
          await prisma.transaction.update({
            where: { plaidTransactionId },
            data: {
              amount: normalizedAmount,
              date: new Date(transaction.date),
              // Preserve name if it was edited by user, otherwise update to Plaid's name
              name: preserveName ? currentName : plaidName,
              category,
              pending: transaction.pending || false,
              merchantName: transaction.merchant_name || null,
              paymentChannel: transaction.payment_channel || null,
              authorizedDate: transaction.authorized_date ? new Date(transaction.authorized_date) : null,
              // Set originalDescription if not already set (for future comparisons)
              originalDescription: existing.originalDescription || plaidName,
              lastSynced: new Date(),
            },
          });
          updatedCount++;
        } else {
          // Create new transaction
          const plaidName = transaction.name;
          await prisma.transaction.create({
            data: {
              plaidTransactionId,
              accountId: dbAccountId,
              userId,
              amount: normalizedAmount,
              date: new Date(transaction.date),
              name: plaidName,
              category,
              pending: transaction.pending || false,
              currency: transaction.iso_currency_code || transaction.currency || 'USD',
              merchantName: transaction.merchant_name || null,
              paymentChannel: transaction.payment_channel || null,
              authorizedDate: transaction.authorized_date ? new Date(transaction.authorized_date) : null,
              // Store original description for future comparison
              originalDescription: plaidName,
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
