import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from './utils';
import { getPrismaClient } from '../prisma-client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  headers: Request['headers'];
  body: any;
}

export async function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Verify user still exists and is active
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or account deactivated' });
      return;
    }

    // Attach user to request
    req.user = {
      id: payload.userId,
      email: user.email
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await authenticateUser(req, res, next);
}

export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractTokenFromHeader(req.headers.authorization);
  
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      (req as AuthenticatedRequest).user = {
        id: payload.userId,
        email: payload.email
      };
    }
  }
  
  next();
}
