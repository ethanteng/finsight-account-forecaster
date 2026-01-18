import { config } from 'dotenv';
import express, { Application, Request, Response, Router } from 'express';
import cors from 'cors';

// Load environment variables
// Prisma CLI reads .env by default, so we load .env first, then .env.local can override it
if (process.env.NODE_ENV !== 'production') {
  config(); // Loads .env by default
  config({ path: '.env.local', override: true }); // .env.local can override .env values
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

const app: Application = express();

// CORS setup
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3000'
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Account Forecaster API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Import routes
import authRoutes from './auth/routes';
import { setupPlaidRoutes } from './plaid';
import accountsRoutes from './routes/accounts';
import transactionsRoutes from './routes/transactions';
import forecastsRoutes from './routes/forecasts';
import recurringRoutes from './routes/recurring';

// Setup routes
app.use('/api/auth', authRoutes);
const plaidRouter = Router();
setupPlaidRoutes(plaidRouter);
app.use('/api/plaid', plaidRouter);
app.use('/api/accounts', accountsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/forecasts', forecastsRoutes);
app.use('/api/recurring', recurringRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Account Forecaster API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
