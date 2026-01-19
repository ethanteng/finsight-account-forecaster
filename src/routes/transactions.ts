import { Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../auth/middleware';
import { TransactionService } from '../services/transaction-service';
import { RecurringDetector } from '../services/recurring-detector';
import { getPrismaClient } from '../prisma-client';

const router = Router();
const transactionService = new TransactionService();
const recurringDetector = new RecurringDetector();
const prisma = getPrismaClient();

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

// Update transaction name/description
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name } = req.body;

    console.log(`[PUT /api/transactions/${id}] Updating transaction name for user ${userId}`);
    console.log(`[PUT /api/transactions/${id}] Request body:`, { name });

    if (!id) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Transaction name is required' });
    }

    // Verify transaction belongs to user
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      console.log(`[PUT /api/transactions/${id}] Transaction not found for user ${userId}`);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    console.log(`[PUT /api/transactions/${id}] Found transaction:`, { 
      id: transaction.id, 
      currentName: transaction.name,
      newName: name.trim() 
    });

    // When user edits the name, preserve the originalDescription if it exists
    // This helps us detect user edits during future syncs
    const updateData: any = { name: name.trim() };
    
    // If originalDescription is not set, set it to the current name before update
    // (which should be the original Plaid name)
    if (!transaction.originalDescription) {
      updateData.originalDescription = transaction.name;
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    console.log(`[PUT /api/transactions/${id}] Transaction updated successfully:`, { 
      id: updated.id, 
      name: updated.name 
    });

    res.json({ transaction: updated });
  } catch (error: any) {
    console.error(`[PUT /api/transactions/:id] Error updating transaction:`, error);
    res.status(500).json({ error: error.message || 'Failed to update transaction' });
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

    // Note: We no longer auto-detect patterns on sync to preserve user-created patterns
    // Users can manually trigger pattern detection from the Recurring Patterns page
    // This prevents losing manually created patterns and edits when syncing transactions
    const patternsDetected = 0;

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
