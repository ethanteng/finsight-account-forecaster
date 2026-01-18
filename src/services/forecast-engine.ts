import { getPrismaClient } from '../prisma-client';

const prisma = getPrismaClient();

interface BalanceSnapshot {
  date: Date;
  balance: number;
}

/**
 * Calculate next occurrence dates for a recurring pattern
 */
function calculateNextOccurrences(
  pattern: any,
  startDate: Date,
  endDate: Date
): Date[] {
  const occurrences: Date[] = [];
  let currentDate = new Date(startDate);

  // If pattern has an endDate, don't go beyond it
  const patternEndDate = pattern.endDate ? new Date(pattern.endDate) : null;
  const effectiveEndDate = patternEndDate && patternEndDate < endDate 
    ? patternEndDate 
    : endDate;

  while (currentDate <= effectiveEndDate) {
    let nextDate: Date;

    switch (pattern.frequency) {
      case 'daily':
        nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        break;

      case 'weekly':
        nextDate = new Date(currentDate);
        if (pattern.dayOfWeek !== null && pattern.dayOfWeek !== undefined) {
          // Find next occurrence of this day of week
          const daysUntil = (pattern.dayOfWeek - nextDate.getDay() + 7) % 7;
          nextDate.setDate(nextDate.getDate() + (daysUntil || 7));
        } else {
          nextDate.setDate(nextDate.getDate() + 7);
        }
        break;

      case 'biweekly':
        nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 14);
        break;

      case 'monthly':
        nextDate = new Date(currentDate);
        if (pattern.dayOfMonth !== null && pattern.dayOfMonth !== undefined) {
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(pattern.dayOfMonth);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        break;

      case 'quarterly':
        nextDate = new Date(currentDate);
        nextDate.setMonth(nextDate.getMonth() + 3);
        if (pattern.dayOfMonth !== null && pattern.dayOfMonth !== undefined) {
          nextDate.setDate(pattern.dayOfMonth);
        }
        break;

      case 'yearly':
        nextDate = new Date(currentDate);
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        if (pattern.dayOfMonth !== null && pattern.dayOfMonth !== undefined) {
          nextDate.setDate(pattern.dayOfMonth);
        }
        break;

      default:
        return occurrences;
    }

    if (nextDate <= effectiveEndDate) {
      occurrences.push(new Date(nextDate));
      currentDate = nextDate;
    } else {
      break;
    }
  }

  return occurrences;
}

export class ForecastEngine {
  /**
   * Generate forecast transactions from recurring patterns
   */
  async generateForecastTransactions(
    userId: string,
    accountId: string,
    forecastId: string,
    startDate: Date,
    endDate: Date,
    includePatternIds?: string[]
  ): Promise<any[]> {
    // Get recurring patterns
    const where: any = {
      userId,
      accountId,
    };

    if (includePatternIds && includePatternIds.length > 0) {
      where.id = { in: includePatternIds };
    }

    const patterns = await prisma.recurringPattern.findMany({
      where,
    });

    const forecastTransactions: any[] = [];

    // Generate transactions for each pattern
    for (const pattern of patterns) {
      const occurrences = calculateNextOccurrences(pattern, startDate, endDate);

      for (const occurrenceDate of occurrences) {
        // Determine amount (use pattern amount, adjust sign based on type)
        let amount = pattern.amount;
        if (pattern.transactionType === 'expense') {
          amount = -Math.abs(amount);
        } else {
          amount = Math.abs(amount);
        }

        const forecastTransaction = await prisma.forecastTransaction.create({
          data: {
            userId,
            accountId,
            forecastId,
            recurringPatternId: pattern.id,
            isManual: false,
            amount,
            date: occurrenceDate,
            name: pattern.name,
            category: null,
          },
        });

        forecastTransactions.push(forecastTransaction);
      }
    }

    return forecastTransactions;
  }

  /**
   * Project balance day-by-day through forecast period
   */
  async projectBalance(
    userId: string,
    accountId: string,
    forecastId: string,
    initialBalance: number,
    startDate: Date,
    endDate: Date
  ): Promise<BalanceSnapshot[]> {
    // Get all forecast transactions for this forecast
    const transactions = await prisma.forecastTransaction.findMany({
      where: {
        forecastId,
        userId,
        accountId,
      },
      orderBy: {
        date: 'asc',
      },
    });

    const snapshots: BalanceSnapshot[] = [];
    let currentBalance = initialBalance;
    let currentDate = new Date(startDate);
    const end = new Date(endDate);

    // Group transactions by date
    const transactionsByDate = new Map<string, any[]>();
    for (const transaction of transactions) {
      const dateKey = transaction.date.toISOString().split('T')[0];
      if (!transactionsByDate.has(dateKey)) {
        transactionsByDate.set(dateKey, []);
      }
      transactionsByDate.get(dateKey)!.push(transaction);
    }

    // Iterate day by day
    while (currentDate <= end) {
      const dateKey = currentDate.toISOString().split('T')[0];
      
      // Apply transactions for this date
      const dayTransactions = transactionsByDate.get(dateKey) || [];
      for (const transaction of dayTransactions) {
        currentBalance += transaction.amount;
      }

      snapshots.push({
        date: new Date(currentDate),
        balance: currentBalance,
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return snapshots;
  }

  /**
   * Generate a complete forecast
   */
  async generateForecast(
    userId: string,
    accountId: string,
    endDate: Date,
    includePatternIds?: string[]
  ): Promise<any> {
    // Get account current balance
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const initialBalance = account.currentBalance || 0;
    const startDate = new Date();

    // Create forecast record
    const forecast = await prisma.forecast.create({
      data: {
        userId,
        accountId,
        startDate,
        endDate,
        initialBalance,
        projectedBalance: initialBalance, // Will be updated after projection
        metadata: {
          includePatternIds: includePatternIds || [],
        },
      },
    });

    // Generate forecast transactions
    const transactions = await this.generateForecastTransactions(
      userId,
      accountId,
      forecast.id,
      startDate,
      endDate,
      includePatternIds
    );

    // Project balance
    const balanceSnapshots = await this.projectBalance(
      userId,
      accountId,
      forecast.id,
      initialBalance,
      startDate,
      endDate
    );

    // Update forecast with projected balance
    const finalBalance = balanceSnapshots[balanceSnapshots.length - 1]?.balance || initialBalance;
    await prisma.forecast.update({
      where: { id: forecast.id },
      data: {
        projectedBalance: finalBalance,
      },
    });

    return {
      forecast,
      transactions,
      balanceSnapshots,
    };
  }
}
