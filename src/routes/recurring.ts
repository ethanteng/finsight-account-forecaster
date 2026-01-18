import { Router } from 'express';
import { getPrismaClient } from '../prisma-client';
import { authenticateUser, AuthenticatedRequest } from '../auth/middleware';
import { RecurringDetector } from '../services/recurring-detector';

const router = Router();
const prisma = getPrismaClient();
const detector = new RecurringDetector();

// Detect recurring patterns
router.post('/detect', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const { accountId, minConfidence } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    // Use redetectPatterns to avoid duplicates when re-running detection
    console.log(`Detecting patterns for account ${accountId} with minConfidence ${minConfidence || 0.6}`);
    
    // First check how many transactions we have
    const transactionCount = await prisma.transaction.count({
      where: { userId, accountId },
    });
    console.log(`Found ${transactionCount} transactions for pattern detection`);

    const patterns = await detector.redetectPatterns(
      userId,
      accountId,
      minConfidence || 0.6
    );

    console.log(`Detected ${patterns.length} recurring patterns`);
    res.json({ patterns, transactionCount });
  } catch (error: any) {
    console.error('Error detecting patterns:', error);
    res.status(500).json({ error: error.message || 'Failed to detect patterns' });
  }
});

// Get all patterns for an account
router.get('/patterns', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const { accountId } = req.query;

    const where: any = { userId };
    if (accountId) {
      where.accountId = accountId as string;
    }

    const patterns = await prisma.recurringPattern.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ patterns });
  } catch (error: any) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch patterns' });
  }
});

// Edit pattern
router.put('/patterns/:id', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { endDate, amount, frequency } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Pattern ID is required' });
    }

    const pattern = await prisma.recurringPattern.findFirst({
      where: { id, userId },
    });

    if (!pattern) {
      return res.status(404).json({ error: 'Pattern not found' });
    }

    const updated = await prisma.recurringPattern.update({
      where: { id },
      data: {
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(amount !== undefined && { amount }),
        ...(frequency && { frequency }),
      },
    });

    res.json({ pattern: updated });
  } catch (error: any) {
    console.error('Error updating pattern:', error);
    res.status(500).json({ error: error.message || 'Failed to update pattern' });
  }
});

// Delete pattern
router.delete('/patterns/:id', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      return res.status(400).json({ error: 'Pattern ID is required' });
    }

    const pattern = await prisma.recurringPattern.findFirst({
      where: { id, userId },
    });

    if (!pattern) {
      return res.status(404).json({ error: 'Pattern not found' });
    }

    await prisma.recurringPattern.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting pattern:', error);
    res.status(500).json({ error: error.message || 'Failed to delete pattern' });
  }
});

// Get transactions not in any recurring pattern
router.get('/transactions/available', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const { accountId, limit = 50 } = req.query;

    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    // Get all transactions for this account
    const allTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        accountId: accountId as string,
      },
      orderBy: {
        date: 'desc',
      },
      take: parseInt(limit as string, 10),
    });

    // Get all existing patterns for this account
    const patterns = await prisma.recurringPattern.findMany({
      where: {
        userId,
        accountId: accountId as string,
      },
    });

    // Helper function to normalize merchant name (same as in recurring-detector.ts)
    const normalizeMerchantName = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
    };

    // Helper function to check if amounts are similar
    const amountsSimilar = (amount1: number, amount2: number, variance: number = 0.10): boolean => {
      const diff = Math.abs(amount1 - amount2);
      const avg = (Math.abs(amount1) + Math.abs(amount2)) / 2;
      if (avg === 0) return amount1 === amount2;
      return diff <= avg * variance;
    };

    // Filter out transactions that match existing patterns
    const availableTransactions = allTransactions.filter(transaction => {
      const transactionName = transaction.name || transaction.merchantName || '';
      const normalizedTransactionName = normalizeMerchantName(transactionName);
      const transactionAmount = Math.abs(transaction.amount);

      // Check if this transaction matches any existing pattern
      const matchesPattern = patterns.some(pattern => {
        const patternName = pattern.name || pattern.merchantName || '';
        const normalizedPatternName = normalizeMerchantName(patternName);
        const patternAmount = pattern.amount;
        const variance = pattern.amountVariance || 0.10;

        return (
          normalizedTransactionName === normalizedPatternName &&
          amountsSimilar(transactionAmount, patternAmount, variance)
        );
      });

      return !matchesPattern;
    });

    res.json({ transactions: availableTransactions });
  } catch (error: any) {
    console.error('Error fetching available transactions:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch available transactions' });
  }
});

// Create a recurring pattern manually from a transaction
router.post('/patterns/create-from-transaction', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const { transactionId, frequency, dayOfMonth, dayOfWeek, amount, name } = req.body;

    if (!transactionId || !frequency) {
      return res.status(400).json({ error: 'transactionId and frequency are required' });
    }

    // Get the transaction
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Normalize merchant name
    const normalizeMerchantName = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
    };

    // Determine transaction type: In Plaid, expenses are negative, income is positive
    const transactionType = transaction.amount > 0 ? 'income' : 'expense';
    // Use the original transaction amount sign, or apply sign to user-provided amount based on type
    const patternAmount = amount 
      ? (transactionType === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)))
      : transaction.amount;
    const patternName = name || transaction.name || transaction.merchantName || 'Recurring Transaction';

    // Create the pattern
    const pattern = await prisma.recurringPattern.create({
      data: {
        userId,
        accountId: transaction.accountId,
        name: patternName,
        merchantName: normalizeMerchantName(transaction.merchantName || transaction.name || ''),
        amount: patternAmount,
        amountVariance: Math.abs(patternAmount) * 0.10, // ±10% default variance based on absolute value
        frequency,
        dayOfMonth: dayOfMonth || null,
        dayOfWeek: dayOfWeek || null,
        startDate: transaction.date,
        transactionType,
        confidence: 0.9, // High confidence for manually created patterns
      },
    });

    res.json({ pattern });
  } catch (error: any) {
    console.error('Error creating pattern from transaction:', error);
    res.status(500).json({ error: error.message || 'Failed to create pattern' });
  }
});

export default router;
