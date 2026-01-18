import { Router } from 'express';
import { getPrismaClient } from '../prisma-client';
import { authenticateUser, AuthenticatedRequest } from '../auth/middleware';

const router = Router();
const prisma = getPrismaClient();

// Get all accounts for user
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;

    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });

    res.json({ accounts });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get single account
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.user!.id;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const account = await prisma.account.findFirst({
      where: { id, userId },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ account });
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

export default router;
