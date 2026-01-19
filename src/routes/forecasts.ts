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

    const updated = await prisma.forecastTransaction.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount }),
        ...(date && { date: parseLocalDate(date) }),
        ...(name && { name }),
        ...(category !== undefined && { category }),
        ...(note !== undefined && { note }),
      },
    });

    res.json({ transaction: updated });
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
    const { accountId, forecastId, amount, date, name, category, note } = req.body;

    if (!accountId || !forecastId || !amount || !date || !name) {
      return res.status(400).json({ error: 'accountId, forecastId, amount, date, and name are required' });
    }

    const transaction = await prisma.forecastTransaction.create({
      data: {
        userId,
        accountId,
        forecastId,
        isManual: true,
        amount,
        date: parseLocalDate(date),
        name,
        category: category || null,
        note: note || null,
      },
    });

    res.json({ transaction });
  } catch (error: any) {
    console.error('Error creating manual transaction:', error);
    res.status(500).json({ error: error.message || 'Failed to create manual transaction' });
  }
});

export default router;
