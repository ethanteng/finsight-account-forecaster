import { getPrismaClient } from '../prisma-client';

const prisma = getPrismaClient();

interface TransactionGroup {
  name: string;
  merchantName: string;
  transactions: any[];
  averageAmount: number;
  amountVariance: number;
}

interface FrequencyAnalysis {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfMonth?: number;
  dayOfWeek?: number;
  confidence: number;
  startDate: Date;
}

/**
 * Normalize merchant name for grouping
 */
function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Check if two amounts are similar (±10% variance for more lenient matching)
 */
function amountsSimilar(amount1: number, amount2: number, variance: number = 0.10): boolean {
  const diff = Math.abs(amount1 - amount2);
  const avg = (Math.abs(amount1) + Math.abs(amount2)) / 2;
  if (avg === 0) return amount1 === amount2;
  return diff <= avg * variance;
}

/**
 * Group transactions by merchant/name and similar amounts
 */
function groupTransactions(transactions: any[]): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>();

  for (const transaction of transactions) {
    const normalizedName = normalizeMerchantName(transaction.name || transaction.merchantName || '');
    const merchantName = transaction.merchantName || transaction.name || '';
    const amount = Math.abs(transaction.amount);

    // Find existing group with similar name and amount
    let matchedGroup: TransactionGroup | null = null;
    for (const [key, group] of groups.entries()) {
      if (
        normalizeMerchantName(group.name) === normalizedName &&
        amountsSimilar(group.averageAmount, amount)
      ) {
        matchedGroup = group;
        break;
      }
    }

    if (matchedGroup) {
      matchedGroup.transactions.push(transaction);
      // Recalculate average
      const total = matchedGroup.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      matchedGroup.averageAmount = total / matchedGroup.transactions.length;
    } else {
      const groupKey = `${normalizedName}_${amount.toFixed(2)}`;
      groups.set(groupKey, {
        name: transaction.name || merchantName,
        merchantName,
        transactions: [transaction],
        averageAmount: amount,
        amountVariance: amount * 0.10, // ±10%
      });
    }
  }

  return Array.from(groups.values());
}

/**
 * Analyze frequency pattern for a group of transactions
 */
function analyzeFrequency(transactions: any[]): FrequencyAnalysis | null {
  if (transactions.length < 3) {
    return null; // Need at least 3 occurrences
  }

  // Sort by date
  const sorted = [...transactions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const dates = sorted.map(t => new Date(t.date));
  const intervals: number[] = [];

  // Calculate intervals between consecutive transactions (in days)
  for (let i = 1; i < dates.length; i++) {
    const diff = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
    intervals.push(diff);
  }

  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  // Determine frequency based on average interval
  let frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  let dayOfMonth: number | undefined;
  let dayOfWeek: number | undefined;
  let confidence = 0.0;

  // Daily: 1-2 days
  if (avgInterval >= 1 && avgInterval <= 2) {
    frequency = 'daily';
    confidence = Math.max(0, 1 - stdDev / avgInterval);
  }
  // Weekly: 7±2 days
  else if (avgInterval >= 5 && avgInterval <= 9) {
    frequency = 'weekly';
    dayOfWeek = dates[0].getDay();
    confidence = Math.max(0, 1 - stdDev / 7);
  }
  // Biweekly: 14±3 days
  else if (avgInterval >= 11 && avgInterval <= 17) {
    frequency = 'biweekly';
    dayOfWeek = dates[0].getDay();
    confidence = Math.max(0, 1 - stdDev / 14);
  }
  // Monthly: ~30 days, check day of month
  else if (avgInterval >= 25 && avgInterval <= 35) {
    frequency = 'monthly';
    dayOfMonth = dates[0].getDate();
    confidence = Math.max(0, 1 - stdDev / 30);
  }
  // Quarterly: ~90 days
  else if (avgInterval >= 80 && avgInterval <= 100) {
    frequency = 'quarterly';
    dayOfMonth = dates[0].getDate();
    confidence = Math.max(0, 1 - stdDev / 90);
  }
  // Yearly: ~365 days
  else if (avgInterval >= 350 && avgInterval <= 380) {
    frequency = 'yearly';
    dayOfMonth = dates[0].getDate();
    confidence = Math.max(0, 1 - stdDev / 365);
  }
  else {
    return null; // No clear pattern
  }

  // Adjust confidence based on number of occurrences
  const minOccurrences = frequency === 'monthly' || frequency === 'quarterly' ? 3 : 2;
  const occurrenceBonus = Math.min(1, (transactions.length - minOccurrences) / 5);
  confidence = Math.min(1, confidence * 0.7 + occurrenceBonus * 0.3);

  // Minimum confidence threshold
  if (confidence < 0.6) {
    return null;
  }

  return {
    frequency,
    dayOfMonth,
    dayOfWeek,
    confidence,
    startDate: dates[0],
  };
}

/**
 * Determine transaction type (income or expense)
 */
function determineTransactionType(transactions: any[]): 'income' | 'expense' {
  // Count positive vs negative amounts
  const positiveCount = transactions.filter(t => t.amount > 0).length;
  const negativeCount = transactions.filter(t => t.amount < 0).length;

  return positiveCount > negativeCount ? 'income' : 'expense';
}

export class RecurringDetector {
  /**
   * Detect recurring patterns from transaction history
   */
  async detectPatterns(
    userId: string,
    accountId: string,
    minConfidence: number = 0.6
  ): Promise<any[]> {
    // Get transactions from database
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        accountId,
      },
      orderBy: {
        date: 'asc',
      },
    });

    if (transactions.length < 3) {
      console.log(`Not enough transactions for pattern detection: ${transactions.length} < 3`);
      return []; // Need at least 3 transactions to detect patterns
    }

    console.log(`Analyzing ${transactions.length} transactions for recurring patterns`);

    // Group transactions
    const groups = groupTransactions(transactions);
    console.log(`Grouped transactions into ${groups.length} groups`);

    const patterns: any[] = [];

    // Analyze each group
    for (const group of groups) {
      if (group.transactions.length < 3) {
        console.log(`Skipping group "${group.name}" - only ${group.transactions.length} transactions`);
        continue; // Skip groups with too few transactions
      }

      console.log(`Analyzing group "${group.name}" with ${group.transactions.length} transactions, avg amount: ${group.averageAmount}`);
      const frequencyAnalysis = analyzeFrequency(group.transactions);
      if (!frequencyAnalysis) {
        console.log(`No frequency pattern detected for "${group.name}"`);
        continue;
      }
      if (frequencyAnalysis.confidence < minConfidence) {
        console.log(`Pattern for "${group.name}" has low confidence: ${frequencyAnalysis.confidence} < ${minConfidence}`);
        continue;
      }
      console.log(`Found pattern for "${group.name}": ${frequencyAnalysis.frequency}, confidence: ${frequencyAnalysis.confidence}`);

      const transactionType = determineTransactionType(group.transactions);

      // Create pattern record
      const pattern = await prisma.recurringPattern.create({
        data: {
          userId,
          accountId,
          name: group.name,
          merchantName: normalizeMerchantName(group.merchantName),
          amount: group.averageAmount,
          amountVariance: group.amountVariance,
          frequency: frequencyAnalysis.frequency,
          dayOfMonth: frequencyAnalysis.dayOfMonth || null,
          dayOfWeek: frequencyAnalysis.dayOfWeek || null,
          startDate: frequencyAnalysis.startDate,
          transactionType,
          confidence: frequencyAnalysis.confidence,
        },
      });

      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Re-detect patterns (delete old ones and create new)
   */
  async redetectPatterns(
    userId: string,
    accountId: string,
    minConfidence: number = 0.6
  ): Promise<any[]> {
    // Delete existing patterns for this account
    await prisma.recurringPattern.deleteMany({
      where: {
        userId,
        accountId,
      },
    });

    // Detect new patterns
    return this.detectPatterns(userId, accountId, minConfidence);
  }
}
