import { Router } from 'express';
import { getPrismaClient } from '../prisma-client';
import { authenticateUser, AuthenticatedRequest } from '../auth/middleware';
import { ForecastEngine } from '../services/forecast-engine';

const router = Router();
const prisma = getPrismaClient();
const forecastEngine = new ForecastEngine();

// Helper function to parse date string as UTC date at noon
// This prevents timezone shifts when storing dates from date input fields
// By using UTC noon, we ensure the date part is preserved regardless of server timezone
function parseLocalDate(dateString: string): Date {
  // Parse date string in format YYYY-MM-DD
  const parts = dateString.split('-');
  if (parts.length !== 3) {
    // Fallback to standard parsing if format is unexpected
    return new Date(dateString);
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
  const day = parseInt(parts[2], 10);
  // Create date at UTC noon to avoid timezone shifts and DST issues
  // This ensures the date part (year-month-day) is preserved
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

// Generate new forecast
router.post('/generate', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const { accountId, endDate, includePatternIds } = req.body;

    if (!accountId || !endDate) {
      return res.status(400).json({ error: 'accountId and endDate are required' });
    }

    const end = new Date(endDate);
    const result = await forecastEngine.generateForecast(
      userId,
      accountId,
      end,
      includePatternIds
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error generating forecast:', error);
    res.status(500).json({ error: error.message || 'Failed to generate forecast' });
  }
});

// Get forecast details
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      return res.status(400).json({ error: 'Forecast ID is required' });
    }

    const forecast = await prisma.forecast.findFirst({
      where: { id, userId },
      include: {
        forecastTransactions: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!forecast) {
      return res.status(404).json({ error: 'Forecast not found' });
    }

    // Get balance snapshots
    const balanceSnapshots = await forecastEngine.projectBalance(
      userId,
      forecast.accountId,
      forecast.id,
      forecast.initialBalance,
      forecast.startDate,
      forecast.endDate
    );

    res.json({
      forecast,
      balanceSnapshots,
    });
  } catch (error: any) {
    console.error('Error fetching forecast:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch forecast' });
  }
});

// Get balance projections
router.get('/:id/balance', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      return res.status(400).json({ error: 'Forecast ID is required' });
    }

    const forecast = await prisma.forecast.findFirst({
      where: { id, userId },
    });

    if (!forecast) {
      return res.status(404).json({ error: 'Forecast not found' });
    }

    const balanceSnapshots = await forecastEngine.projectBalance(
      userId,
      forecast.accountId,
      forecast.id,
      forecast.initialBalance,
      forecast.startDate,
      forecast.endDate
    );

    res.json({ balanceSnapshots });
  } catch (error: any) {
    console.error('Error fetching balance projections:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch balance projections' });
  }
});

// Edit forecast transaction
router.put('/transactions/:id', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { amount, date, name, category, note } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const transaction = await prisma.forecastTransaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update the transaction
    // Mark as manual if it wasn't already, so user edits persist during forecast regeneration
    // Keep recurringPatternId so we can prevent duplicates during regeneration
    const updateData: any = {
      ...(amount !== undefined && { amount }),
      ...(date && { date: parseLocalDate(date) }),
      ...(name && { name }),
      ...(category !== undefined && { category }),
      ...(note !== undefined && { note }),
    };
    
    // If this transaction was generated from a pattern and is being edited,
    // mark it as manual so it persists during forecast regeneration
    // We keep the recurringPatternId so duplicate detection can prevent recreating it
    if (!transaction.isManual && transaction.recurringPatternId) {
      updateData.isManual = true;
    }
    
    const updated = await prisma.forecastTransaction.update({
      where: { id },
      data: updateData,
    });

    // Get the forecast to recalculate balances
    // Only proceed if forecastId exists (it's nullable in the schema)
    const forecast = transaction.forecastId ? await prisma.forecast.findFirst({
      where: { id: transaction.forecastId, userId },
    }) : null;

    if (forecast) {
      // Recalculate balance snapshots
      const balanceSnapshots = await forecastEngine.projectBalance(
        userId,
        transaction.accountId,
        forecast.id,
        forecast.initialBalance,
        forecast.startDate,
        forecast.endDate
      );

      // Update forecast with new projected balance
      const finalBalance = balanceSnapshots[balanceSnapshots.length - 1]?.balance || forecast.initialBalance;
      await prisma.forecast.update({
        where: { id: forecast.id },
        data: {
          projectedBalance: finalBalance,
        },
      });

      // Return updated transaction, balance snapshots, and forecast
      res.json({ 
        transaction: updated,
        balanceSnapshots,
        forecast: {
          ...forecast,
          projectedBalance: finalBalance,
        },
      });
    } else {
      // If forecast not found, just return the updated transaction
      res.json({ transaction: updated });
    }
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: error.message || 'Failed to update transaction' });
  }
});

// Delete forecast transaction
router.delete('/transactions/:id', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const transaction = await prisma.forecastTransaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await prisma.forecastTransaction.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: error.message || 'Failed to delete transaction' });
  }
});

// Add manual transaction
router.post('/transactions/manual', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const { 
      accountId, 
      forecastId, 
      amount, 
      transactionType: requestedTransactionType,
      date, 
      name, 
      category, 
      note,
      isRecurring,
      frequency,
      dayOfMonth,
      dayOfWeek,
      recurringEndDate
    } = req.body;

    if (!accountId || !forecastId || !amount || !date || !name) {
      return res.status(400).json({ error: 'accountId, forecastId, amount, date, and name are required' });
    }

    if (isRecurring && !frequency) {
      return res.status(400).json({ error: 'frequency is required when creating a recurring transaction' });
    }

    // Use explicit transactionType from request, or infer from amount sign as fallback
    const transactionType = requestedTransactionType || (amount > 0 ? 'income' : 'expense');

    // Parse dates using parseLocalDate to ensure timezone-safe date handling
    // This converts YYYY-MM-DD strings to UTC dates at noon, preventing timezone shifts
    const transactionDate = parseLocalDate(date);
    const patternEndDate = recurringEndDate ? parseLocalDate(recurringEndDate) : null;

    // If recurring, create a recurring pattern first
    let recurringPatternId: string | null = null;
    let pattern: any = null;
    if (isRecurring) {
      // Normalize merchant name (same logic as in recurring-detector.ts)
      const normalizeMerchantName = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/[^a-z0-9\s]/g, '')
          .trim();
      };

      pattern = await prisma.recurringPattern.create({
        data: {
          userId,
          accountId,
          name,
          merchantName: normalizeMerchantName(name),
          amount: Math.abs(amount), // Store as positive, sign determined by transactionType
          amountVariance: Math.abs(amount) * 0.10, // ±10% default variance
          frequency,
          dayOfMonth: (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') 
            ? (dayOfMonth ? parseInt(dayOfMonth, 10) : null)
            : null,
          dayOfWeek: (frequency === 'weekly' || frequency === 'biweekly')
            ? (dayOfWeek !== undefined && dayOfWeek !== '' ? parseInt(dayOfWeek, 10) : null)
            : null,
          startDate: transactionDate,
          endDate: patternEndDate,
          transactionType,
          confidence: 0.9, // High confidence for manually created patterns
        },
      });

      recurringPatternId = pattern.id;
    }

    // Create the forecast transaction
    // Use parseLocalDate to ensure timezone-safe date storage (UTC noon)
    const transaction = await prisma.forecastTransaction.create({
      data: {
        userId,
        accountId,
        forecastId,
        recurringPatternId,
        isManual: true,
        amount,
        date: transactionDate,
        name,
        category: category || null,
        note: note || null,
      },
    });

    res.json({ transaction, pattern });
  } catch (error: any) {
    console.error('Error creating manual transaction:', error);
    res.status(500).json({ error: error.message || 'Failed to create manual transaction' });
  }
});

export default router;
