import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { getPrismaClient } from './prisma-client';
import { Router } from 'express';
import { persistTransactionsToDb } from './data/persistence';

const prisma = getPrismaClient();

// Determine Plaid mode from environment variable
const plaidMode = process.env.PLAID_MODE || 'sandbox';
const useSandbox = plaidMode === 'sandbox';

const credentials = {
  clientId: process.env.PLAID_CLIENT_ID || '',
  secret: process.env.PLAID_SECRET || '',
  env: useSandbox ? 'sandbox' : 'production'
};

const configuration = new Configuration({
  basePath: useSandbox ? PlaidEnvironments.sandbox : PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': credentials.clientId,
      'PLAID-SECRET': credentials.secret,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export { plaidClient };

// Helper function to handle Plaid errors
function handlePlaidError(error: any, operation: string) {
  console.error(`Plaid ${operation} error:`, error);
  if (error.response?.data) {
    return {
      error: error.response.data.error_code || 'PLAID_ERROR',
      message: error.response.data.error_message || error.message,
      display_message: error.response.data.display_message
    };
  }
  return {
    error: 'PLAID_ERROR',
    message: error.message || 'Unknown Plaid error'
  };
}

export const setupPlaidRoutes = (app: Router) => {
  // Create link token
  app.post('/create-link-token', async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const request = {
        user: { client_user_id: userId },
        client_name: 'Account Forecaster',
        language: 'en',
        country_codes: [CountryCode.Us],
        products: [Products.Transactions],
        webhook: process.env.PLAID_WEBHOOK_URL || undefined,
      };

      const createTokenResponse = await plaidClient.linkTokenCreate(request);
      res.json({ link_token: createTokenResponse.data.link_token });
    } catch (error) {
      const errorInfo = handlePlaidError(error, 'creating link token');
      res.status(500).json(errorInfo);
    }
  });

  // Exchange public token for access token
  app.post('/exchange-public-token', async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { public_token } = req.body;
      if (!public_token) {
        return res.status(400).json({ error: 'public_token is required' });
      }

      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token,
      });

      const accessToken = exchangeResponse.data.access_token;
      const itemId = exchangeResponse.data.item_id;

      // Get institution info
      const itemResponse = await plaidClient.itemGet({
        access_token: accessToken,
      });
      const institutionId = itemResponse.data.item.institution_id;
      let institutionName = null;
      
      if (institutionId) {
        try {
          const institutionResponse = await plaidClient.institutionsGetById({
            institution_id: institutionId,
            country_codes: [CountryCode.Us],
          });
          institutionName = institutionResponse.data.institution.name;
        } catch (error) {
          console.error('Error fetching institution name:', error);
        }
      }

      // Store access token
      const tokenRecord = await prisma.accessToken.create({
        data: {
          token: accessToken,
          itemId,
          userId,
          isActive: true,
          lastRefreshed: new Date(),
          institutionName,
        },
      });

      // Fetch and persist accounts
      try {
        const accountsResponse = await plaidClient.accountsGet({
          access_token: accessToken,
        });

        const accounts = accountsResponse.data.accounts
          .filter((acc: any) => acc.type === 'depository')
          .map((acc: any) => ({
            account_id: acc.account_id,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype,
            mask: acc.mask,
            balances: acc.balances,
            official_name: acc.official_name,
            institution: institutionName,
          }));

        // Persist accounts (empty transactions array, just to create accounts)
        await persistTransactionsToDb(userId, [], accounts);
      } catch (error) {
        console.error('Error syncing accounts after connection:', error);
        // Don't fail the whole request if account sync fails
      }

      res.json({ 
        success: true,
        access_token: accessToken,
        item_id: itemId
      });
    } catch (error) {
      const errorInfo = handlePlaidError(error, 'exchanging public token');
      res.status(500).json(errorInfo);
    }
  });

  // Get accounts
  app.get('/accounts', async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get user's access tokens
      const accessTokens = await prisma.accessToken.findMany({
        where: {
          userId,
          isActive: true,
        },
      });

      if (accessTokens.length === 0) {
        return res.json({ accounts: [] });
      }

      const allAccounts: any[] = [];

      for (const tokenRecord of accessTokens) {
        try {
          const accountsResponse = await plaidClient.accountsGet({
            access_token: tokenRecord.token,
          });

          for (const account of accountsResponse.data.accounts) {
            // Only include depository accounts (checking/savings)
            if (account.type === 'depository') {
              allAccounts.push({
                account_id: account.account_id,
                name: account.name,
                type: account.type,
                subtype: account.subtype,
                mask: account.mask,
                balances: account.balances,
                institution: tokenRecord.institutionName || null,
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching accounts for token ${tokenRecord.id}:`, error);
          // Continue with other tokens
        }
      }

      res.json({ accounts: allAccounts });
    } catch (error) {
      const errorInfo = handlePlaidError(error, 'fetching accounts');
      res.status(500).json(errorInfo);
    }
  });

  // Sync transactions
  app.post('/sync-transactions', async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { accountId } = req.body;
      if (!accountId) {
        return res.status(400).json({ error: 'accountId is required' });
      }

      // Get account to find access token
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: { user: true },
      });

      if (!account || account.userId !== userId) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Find access token for this account's institution
      const accessToken = await prisma.accessToken.findFirst({
        where: {
          userId,
          isActive: true,
        },
      });

      if (!accessToken) {
        return res.status(404).json({ error: 'No access token found' });
      }

      // Use transactionsSync API
      let cursor = accessToken.transactionSyncCursor || null;
      const added: any[] = [];
      const modified: any[] = [];
      const removed: any[] = [];
      let hasMore = true;

      while (hasMore) {
        const syncResponse = await plaidClient.transactionsSync({
          access_token: accessToken.token,
          cursor: cursor || undefined,
        });

        added.push(...syncResponse.data.added);
        modified.push(...syncResponse.data.modified);
        removed.push(...syncResponse.data.removed);
        cursor = syncResponse.data.next_cursor;
        hasMore = syncResponse.data.has_more;
      }

      // Update cursor
      await prisma.accessToken.update({
        where: { id: accessToken.id },
        data: {
          transactionSyncCursor: cursor,
          lastTransactionSync: new Date(),
        },
      });

      // Filter transactions for this account
      const accountTransactions = added.filter(
        (t: any) => t.account_id === account.plaidAccountId
      );

      res.json({
        added: accountTransactions,
        modified: modified.filter((t: any) => t.account_id === account.plaidAccountId),
        removed: removed.filter((t: any) => t.account_id === account.plaidAccountId),
        cursor,
      });
    } catch (error) {
      const errorInfo = handlePlaidError(error, 'syncing transactions');
      res.status(500).json(errorInfo);
    }
  });
};
