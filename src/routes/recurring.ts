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

    const patterns = await detector.detectPatterns(
      userId,
      accountId,
      minConfidence || 0.6
    );

    res.json({ patterns });
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

export default router;
