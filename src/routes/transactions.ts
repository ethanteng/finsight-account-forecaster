import { Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../auth/middleware';
import { TransactionService } from '../services/transaction-service';
import { RecurringDetector } from '../services/recurring-detector';

const router = Router();
const transactionService = new TransactionService();
const recurringDetector = new RecurringDetector();

// Get transactions for an account
router.get('/account/:accountId', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const accountId = Array.isArray(req.params.accountId) ? req.params.accountId[0] : req.params.accountId;
    const { startDate, endDate } = req.query;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const transactions = await transactionService.getTransactionsByAccount(
      userId,
      accountId,
      start,
      end
    );

    res.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Sync transactions from Plaid
router.post('/sync/:accountId', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const accountId = Array.isArray(req.params.accountId) ? req.params.accountId[0] : req.params.accountId;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const result = await transactionService.syncAndPersistTransactions(userId, accountId);

    // Automatically detect recurring patterns after syncing transactions
    let patternsDetected = 0;
    try {
      console.log(`Auto-detecting patterns for account ${accountId} after syncing ${result.added} transactions`);
      const patterns = await recurringDetector.redetectPatterns(userId, accountId, 0.5); // Lower threshold for auto-detection
      patternsDetected = patterns.length;
      console.log(`Detected ${patternsDetected} recurring patterns`);
    } catch (error: any) {
      console.error('Error auto-detecting patterns after sync:', error);
      // Don't fail the sync if pattern detection fails
    }

    res.json({
      success: true,
      ...result,
      patternsDetected
    });
  } catch (error: any) {
    console.error('Error syncing transactions:', error);
    res.status(500).json({ error: error.message || 'Failed to sync transactions' });
  }
});

export default router;
