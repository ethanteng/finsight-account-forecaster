import { getPrismaClient } from '../prisma-client';
import { plaidClient } from '../plaid';
import { persistTransactionsToDb } from '../data/persistence';

const prisma = getPrismaClient();

export class TransactionService {
  /**
   * Fetch transactions from Plaid for a specific account
   */
  async fetchTransactionsFromPlaid(
    userId: string,
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    // Get account
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account || account.userId !== userId) {
      throw new Error('Account not found');
    }

    // Get access token
    const accessToken = await prisma.accessToken.findFirst({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!accessToken) {
      throw new Error('No access token found');
    }

    // Check if we have any transactions for this account
    // If not, reset the cursor to fetch all transactions from the beginning
    const existingTransactionCount = await prisma.transaction.count({
      where: {
        userId,
        accountId,
      },
    });

    let cursor = accessToken.transactionSyncCursor || null;
    
    // If no transactions exist, reset cursor to fetch everything from the beginning
    if (existingTransactionCount === 0 && cursor) {
      console.log(`No transactions found for account ${accountId}, resetting sync cursor to fetch all transactions`);
      cursor = null;
      // Update the access token to clear the cursor
      await prisma.accessToken.update({
        where: { id: accessToken.id },
        data: {
          transactionSyncCursor: null,
        },
      });
    }

    // Default to last 90 days if no dates provided
    const end = endDate || new Date();
    const start = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    console.log(`Fetching transactions for account ${accountId}, cursor: ${cursor ? 'set' : 'null'}, date range: ${start.toISOString()} to ${end.toISOString()}`);

    // Fetch transactions using transactionsSync
    const allTransactions: any[] = [];
    let hasMore = true;

    while (hasMore) {
      const syncResponse = await plaidClient.transactionsSync({
        access_token: accessToken.token,
        cursor: cursor || undefined,
      });

      console.log(`Plaid sync response: ${syncResponse.data.added.length} added, ${syncResponse.data.modified.length} modified, ${syncResponse.data.removed.length} removed, has_more: ${syncResponse.data.has_more}`);

      // Filter transactions for this account
      const accountTransactions = syncResponse.data.added.filter(
        (t: any) => t.account_id === account.plaidAccountId
      );

      console.log(`Filtered to ${accountTransactions.length} transactions for account ${account.plaidAccountId}`);

      allTransactions.push(...accountTransactions);

      cursor = syncResponse.data.next_cursor;
      hasMore = syncResponse.data.has_more;

      // If we've fetched enough history, break
      if (!hasMore || (startDate && allTransactions.length > 0)) {
        const oldestTransaction = allTransactions[allTransactions.length - 1];
        if (oldestTransaction && new Date(oldestTransaction.date) < start) {
          break;
        }
      }
    }

    console.log(`Total transactions fetched: ${allTransactions.length}`);

    // Update cursor
    await prisma.accessToken.update({
      where: { id: accessToken.id },
      data: {
        transactionSyncCursor: cursor,
        lastTransactionSync: new Date(),
      },
    });

    // Filter by date range
    const filteredTransactions = allTransactions.filter((t: any) => {
      const transactionDate = new Date(t.date);
      return transactionDate >= start && transactionDate <= end;
    });

    return filteredTransactions;
  }

  /**
   * Get transactions from database for a specific account
   */
  async getTransactionsByAccount(
    userId: string,
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    const where: any = {
      accountId,
      userId,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = startDate;
      }
      if (endDate) {
        where.date.lte = endDate;
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
    });

    return transactions;
  }

  /**
   * Sync transactions from Plaid and persist to database
   */
  async syncAndPersistTransactions(
    userId: string,
    accountId: string
  ): Promise<{ added: number; updated: number }> {
    // Fetch from Plaid
    const transactions = await this.fetchTransactionsFromPlaid(userId, accountId);

    // Get account info
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Get accounts array for persistence
    const accessToken = await prisma.accessToken.findFirst({
      where: { userId, isActive: true },
    });

    if (!accessToken) {
      throw new Error('No access token found');
    }

    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken.token,
    });

    const accounts = accountsResponse.data.accounts.map((acc: any) => ({
      account_id: acc.account_id,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      mask: acc.mask,
      balances: acc.balances,
    }));

    // Persist to database
    await persistTransactionsToDb(userId, transactions, accounts);

    return {
      added: transactions.length,
      updated: 0, // Persistence function handles this internally
    };
  }

  /**
   * Normalize transaction amount (ensure expenses are negative)
   */
  normalizeTransaction(transaction: any): any {
    // Most transactions from Plaid are purchases (negative for expenses)
    // Income should be positive
    let amount = transaction.amount;

    // Check if this is likely income/credit
    const isIncome = 
      transaction.name?.toLowerCase().includes('deposit') ||
      transaction.name?.toLowerCase().includes('salary') ||
      transaction.name?.toLowerCase().includes('payroll') ||
      transaction.name?.toLowerCase().includes('income') ||
      transaction.category?.some((cat: string) => 
        cat?.toLowerCase().includes('income') || 
        cat?.toLowerCase().includes('transfer')
      );

    // If it's income and negative, make it positive
    if (isIncome && amount < 0) {
      amount = Math.abs(amount);
    }

    // If it's an expense and positive, make it negative
    if (!isIncome && amount > 0) {
      amount = -amount;
    }

    return {
      ...transaction,
      amount,
    };
  }
}
