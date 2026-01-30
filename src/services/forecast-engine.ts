import { getPrismaClient } from '../prisma-client';

const prisma = getPrismaClient();

interface BalanceSnapshot {
  date: Date;
  balance: number;
}

/**
 * Check if a date is after today (not including today)
 * Uses YYYY-MM-DD string comparison for timezone-safe comparison
 */
function isDateAfterToday(date: Date): boolean {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dateStr = date.toISOString().split('T')[0];
  return dateStr > todayStr;
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
  
  // If pattern has an endDate, don't go beyond it
  const patternEndDate = pattern.endDate ? new Date(pattern.endDate) : null;
  const effectiveEndDate = patternEndDate && patternEndDate < endDate 
    ? patternEndDate 
    : endDate;

  // For biweekly patterns, we need to start from the pattern's startDate
  // and find occurrences every 14 days, optionally aligned to a dayOfWeek
  let currentDate: Date;
  if (pattern.frequency === 'biweekly' && pattern.startDate) {
    const patternStart = new Date(pattern.startDate);
    
    // If pattern has dayOfWeek specified, we need to find the first occurrence
    // that falls on that day of week, starting from the pattern's startDate
    if (pattern.dayOfWeek !== null && pattern.dayOfWeek !== undefined) {
      // The pattern startDate is the base - find the first occurrence of dayOfWeek
      // that is >= pattern startDate
      const patternDayOfWeek = patternStart.getDay();
      const targetDayOfWeek = pattern.dayOfWeek;
      
      // Calculate days until the target day of week
      let daysUntil = (targetDayOfWeek - patternDayOfWeek + 7) % 7;
      
      // If pattern startDate is already on the target day, use it
      // Otherwise, find the next occurrence of that day
      const firstOccurrence = new Date(patternStart);
      if (daysUntil > 0) {
        firstOccurrence.setDate(firstOccurrence.getDate() + daysUntil);
      }
      
      // Now find the first occurrence >= forecast startDate
      currentDate = new Date(firstOccurrence);
      while (currentDate < startDate) {
        currentDate.setDate(currentDate.getDate() + 14); // Add 2 weeks
      }
    } else {
      // No dayOfWeek specified, start from pattern startDate or forecast startDate, whichever is later
      currentDate = new Date(patternStart > startDate ? patternStart : startDate);
    }
  } else {
    currentDate = new Date(startDate);
  }

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
        if (pattern.dayOfWeek !== null && pattern.dayOfWeek !== undefined) {
          // For biweekly, we add 14 days (2 weeks) to maintain the same day of week
          nextDate.setDate(nextDate.getDate() + 14);
        } else {
          // No dayOfWeek specified, just add 14 days
          nextDate.setDate(nextDate.getDate() + 14);
        }
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
   * @param tx Optional transaction context - if provided, uses it instead of creating a new transaction
   */
  async generateForecastTransactions(
    userId: string,
    accountId: string,
    forecastId: string,
    startDate: Date,
    endDate: Date,
    includePatternIds?: string[],
    tx?: any
  ): Promise<any[]> {
    // If transaction context is provided, use it; otherwise create a new transaction
    const executeInTransaction = async (transactionContext: any) => {
      // Get recurring patterns
      const where: any = {
        userId,
        accountId,
      };

      if (includePatternIds && includePatternIds.length > 0) {
        where.id = { in: includePatternIds };
      }

      const patterns = await tx.recurringPattern.findMany({
        where,
      });

      const forecastTransactions: any[] = [];

      // Get existing forecast transactions for this forecast to avoid duplicates
      // Compare by pattern ID, date (day only), name, and amount
      // Query within transaction to ensure we see the latest state after deletion
      // Include both manual and non-manual transactions to catch edited transactions
      const existingTransactions = await tx.forecastTransaction.findMany({
        where: {
          forecastId,
          recurringPatternId: {
            not: null, // Only check pattern-based transactions (including edited ones that still have pattern ID)
          },
        },
        select: {
          recurringPatternId: true,
          date: true,
          name: true,
          amount: true,
        },
      });

    // Create a set of existing transaction keys for quick lookup
    // Use date string (YYYY-MM-DD) instead of full ISO string to avoid timezone issues
    // Normalize amounts to avoid floating point comparison issues
    const existingKeys = new Set(
      existingTransactions.map((t: { recurringPatternId: string | null; date: Date; name: string; amount: number }) => {
        const dateStr = t.date.toISOString().split('T')[0]; // YYYY-MM-DD
        const normalizedAmount = Math.round(t.amount * 100) / 100; // Round to 2 decimal places
        return `${t.recurringPatternId || 'null'}-${dateStr}-${t.name}-${normalizedAmount}`;
      })
    );

    // Collect all transactions to create, then batch insert them
    // This reduces race conditions by minimizing the time window between checks and inserts
    const transactionsToCreate: Array<{
      userId: string;
      accountId: string;
      forecastId: string;
      recurringPatternId: string;
      isManual: boolean;
      amount: number;
      date: Date;
      name: string;
      category: null;
    }> = [];

    // Generate transactions for each pattern
    for (const pattern of patterns) {
      const occurrences = calculateNextOccurrences(pattern, startDate, endDate);

      for (const occurrenceDate of occurrences) {
        // Normalize date to UTC noon to ensure consistent timestamps
        const dateStr = occurrenceDate.toISOString().split('T')[0];
        const normalizedDate = new Date(Date.UTC(
          parseInt(dateStr.split('-')[0], 10),
          parseInt(dateStr.split('-')[1], 10) - 1,
          parseInt(dateStr.split('-')[2], 10),
          12, 0, 0, 0
        ));

        // Filter out transactions for today or earlier - only include future transactions
        if (!isDateAfterToday(normalizedDate)) {
          continue;
        }

        // Determine amount (use pattern amount, adjust sign based on type)
        let amount = pattern.amount;
        if (pattern.transactionType === 'expense') {
          amount = -Math.abs(amount);
        } else {
          amount = Math.abs(amount);
        }

        const normalizedAmount = Math.round(amount * 100) / 100;
        const transactionKey = `${pattern.id}-${dateStr}-${pattern.name}-${normalizedAmount}`;
        
        // Skip if already exists in our set (from initial query)
        if (existingKeys.has(transactionKey)) {
          continue;
        }

        // Add to set to prevent duplicates within this batch
        existingKeys.add(transactionKey);

        transactionsToCreate.push({
          userId,
          accountId,
          forecastId,
          recurringPatternId: pattern.id,
          isManual: false,
          amount,
          date: normalizedDate,
          name: pattern.name,
          category: null,
        });
      }
    }

    // Insert transactions one by one with duplicate checks
    // Since we're in a transaction, this is safe - concurrent calls will be serialized
    for (const txnData of transactionsToCreate) {
      const dateStr = txnData.date.toISOString().split('T')[0];
      const normalizedAmount = Math.round(txnData.amount * 100) / 100;
      
      // Check for duplicate within transaction
      // Include both manual and non-manual transactions to prevent duplicates
      // when a user has edited a pattern-generated transaction (which becomes manual)
      const duplicate = await tx.forecastTransaction.findFirst({
        where: {
          forecastId,
          recurringPatternId: txnData.recurringPatternId,
          date: txnData.date,
          name: txnData.name,
          amount: {
            gte: normalizedAmount - 0.01,
            lte: normalizedAmount + 0.01,
          },
        },
      });

      if (!duplicate) {
        const created = await tx.forecastTransaction.create({
          data: txnData,
        });
        forecastTransactions.push(created);
      }
    }

      return forecastTransactions;
    };

    // If transaction context provided, use it; otherwise wrap in new transaction
    if (tx) {
      return await executeInTransaction(tx);
    } else {
      return await prisma.$transaction(executeInTransaction);
    }
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

    // Filter out transactions for today or earlier - only apply future transactions
    const futureTransactions = transactions.filter(transaction => 
      isDateAfterToday(transaction.date)
    );

    const snapshots: BalanceSnapshot[] = [];
    let currentBalance = initialBalance;
    let currentDate = new Date(startDate);
    const end = new Date(endDate);

    // Group transactions by date
    const transactionsByDate = new Map<string, any[]>();
    for (const transaction of futureTransactions) {
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
   * If a forecast already exists for this account, it will be reused and manual transactions preserved
   * Wrapped in a single transaction to prevent race conditions when called concurrently
   */
  async generateForecast(
    userId: string,
    accountId: string,
    endDate: Date,
    includePatternIds?: string[]
  ): Promise<any> {
    // Wrap everything in a single transaction to ensure atomicity
    // This prevents race conditions when generateForecast is called concurrently
    return await prisma.$transaction(async (tx) => {
      // Get account current balance
      const account = await tx.account.findFirst({
        where: { id: accountId, userId },
      });

      if (!account) {
        throw new Error('Account not found');
      }

      const initialBalance = account.currentBalance || 0;
      const startDate = new Date();

      // Check if there's an existing forecast for this account
      // Reuse it to preserve manual transactions
      const existingForecast = await tx.forecast.findFirst({
        where: {
          userId,
          accountId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      let forecast: Awaited<ReturnType<typeof tx.forecast.create>>;
      if (existingForecast) {
        // Update existing forecast
        forecast = await tx.forecast.update({
          where: { id: existingForecast.id },
          data: {
            startDate,
            endDate,
            initialBalance,
            projectedBalance: initialBalance, // Will be updated after projection
            metadata: {
              includePatternIds: includePatternIds || [],
            },
          },
        });

        // Delete only pattern-based transactions (not manual ones)
        // This ensures we don't create duplicates when regenerating
        const deleteResult = await tx.forecastTransaction.deleteMany({
          where: {
            forecastId: forecast.id,
            isManual: false,
          },
        });
        console.log(`Deleted ${deleteResult.count} existing pattern-based forecast transactions before regeneration`);
      } else {
        // Create new forecast record
        forecast = await tx.forecast.create({
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
      }

      // Generate forecast transactions from patterns
      // Pass the transaction context to ensure everything is atomic
      const patternTransactions = await this.generateForecastTransactions(
        userId,
        accountId,
        forecast.id,
        startDate,
        endDate,
        includePatternIds,
        tx // Pass transaction context
      );

      // Get all transactions (manual + pattern-based)
      const allTransactions = await tx.forecastTransaction.findMany({
        where: {
          forecastId: forecast.id,
        },
        orderBy: {
          date: 'asc',
        },
      });

      // Project balance (this doesn't modify DB, so can be outside transaction)
      // But we'll do it inside to keep everything consistent
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
      await tx.forecast.update({
        where: { id: forecast.id },
        data: {
          projectedBalance: finalBalance,
        },
      });

      return {
        forecast,
        transactions: allTransactions,
        balanceSnapshots,
      };
    }, {
      timeout: 30000, // 30 second timeout for long-running forecasts
    });
  }
}
