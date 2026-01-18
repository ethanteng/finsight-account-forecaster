import { Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../auth/middleware';
import { TransactionService } from '../services/transaction-service';

const router = Router();
const transactionService = new TransactionService();

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

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error syncing transactions:', error);
    res.status(500).json({ error: error.message || 'Failed to sync transactions' });
  }
});

export default router;
