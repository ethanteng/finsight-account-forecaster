# Account Forecaster

A standalone application that analyzes transaction history to identify recurring patterns and projects future account balances.

## Features

- **Recurring Transaction Detection**: Automatically detects recurring income and expense patterns from transaction history
- **Balance Forecasting**: Projects account balance into the future based on detected patterns
- **Interactive Controls**: 
  - Edit or delete future transactions
  - Set end dates for recurring patterns
  - Add manual transactions to forecasts
- **Visual Charts**: Interactive balance projection charts with transaction markers

## Tech Stack

- **Backend**: Node.js/TypeScript with Express
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: Next.js 14 with React/TypeScript
- **Integration**: Plaid API for transaction data
- **Authentication**: JWT-based auth

## Setup

### Database Setup with Docker

**Important**: If you have a local PostgreSQL installation running on port 5432, you'll need to either stop it or change the Docker port mapping (see Troubleshooting below).

1. Start PostgreSQL using Docker Compose:
```bash
docker-compose up -d
```

This will start a PostgreSQL 16 container with:
- **Database**: `finsight_account_forecaster`
- **User**: `finsight`
- **Password**: `finsight_password`
- **Port**: `5432`

The database data will be persisted in a Docker volume, so your data will survive container restarts.

To stop the database:
```bash
docker-compose down
```

To stop and remove all data:
```bash
docker-compose down -v
```

**Troubleshooting Database Connection:**

If you get a "role does not exist" or "User was denied access" error:

1. **Check if local PostgreSQL is running**:
   ```bash
   lsof -i :5432
   ```
   If you see a `postgres` process (not `com.docker`), you have a local PostgreSQL instance running.

2. **Stop local PostgreSQL** (macOS with Homebrew):
   ```bash
   brew services stop postgresql@16
   # or
   brew services stop postgresql
   ```
   
   Or stop it manually:
   ```bash
   # Find the process
   ps aux | grep postgres
   # Kill it (replace PID with actual process ID)
   kill <PID>
   ```

3. **Alternative: Use a different port for Docker**:
   Edit `docker-compose.yml` to use port `5433`:
   ```yaml
   ports:
     - "5433:5432"
   ```
   Then update your `.env`:
   ```bash
   DATABASE_URL="postgresql://finsight:finsight_password@localhost:5433/finsight_account_forecaster?schema=public"
   ```

4. **Verify the container is accessible**:
   ```bash
   docker exec -it finsight-account-forecaster-postgres psql -U finsight -d finsight_account_forecaster -c "SELECT current_database(), current_user;"
   ```

### Backend

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   
   **Important**: Prisma CLI requires a `.env` file (not `.env.local`). Create a `.env` file in the project root:
```bash
DATABASE_URL="postgresql://finsight:finsight_password@localhost:5432/finsight_account_forecaster?schema=public"
PLAID_CLIENT_ID="..."
PLAID_SECRET="..."
PLAID_MODE="sandbox"
JWT_SECRET="..."
```

   Note: The backend application loads `.env.local` (configured in `src/index.ts`), but Prisma CLI only reads `.env`. You can either:
   - Use `.env` for both (recommended for local development)
   - Or maintain both files with the same `DATABASE_URL` value

3. Run database migrations:
```bash
npx prisma migrate dev
```

4. Start the backend:
```bash
npm run dev:backend
```

### Frontend

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Set up environment variables (create `frontend/.env.local`):
```bash
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

3. Start the frontend:
```bash
npm run dev
```

## Project Structure

```
finsight-account-forecaster/
├── src/
│   ├── index.ts                    # Express server
│   ├── auth/                       # Authentication system
│   ├── plaid.ts                    # Plaid integration
│   ├── data/
│   │   └── persistence.ts          # Transaction persistence
│   ├── services/
│   │   ├── transaction-service.ts # Transaction management
│   │   ├── recurring-detector.ts   # Pattern detection
│   │   └── forecast-engine.ts      # Forecast generation
│   └── routes/
│       ├── accounts.ts
│       ├── transactions.ts
│       ├── forecasts.ts
│       └── recurring.ts
├── frontend/
│   └── src/
│       ├── app/                    # Next.js pages
│       └── components/             # React components
└── prisma/
    └── schema.prisma               # Database schema
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify token
- `GET /api/auth/profile` - Get user profile

### Plaid
- `POST /api/plaid/create-link-token` - Create Plaid link token
- `POST /api/plaid/exchange-public-token` - Exchange public token
- `GET /api/plaid/accounts` - Get accounts
- `POST /api/plaid/sync-transactions` - Sync transactions

### Accounts
- `GET /api/accounts` - List user accounts
- `GET /api/accounts/:id` - Get account details

### Transactions
- `GET /api/transactions/account/:accountId` - Get transactions
- `POST /api/transactions/sync/:accountId` - Sync transactions from Plaid

### Recurring Patterns
- `POST /api/recurring/detect` - Detect recurring patterns
- `GET /api/recurring/patterns` - List patterns
- `PUT /api/recurring/patterns/:id` - Update pattern
- `DELETE /api/recurring/patterns/:id` - Delete pattern

### Forecasts
- `POST /api/forecasts/generate` - Generate forecast
- `GET /api/forecasts/:id` - Get forecast details
- `GET /api/forecasts/:id/balance` - Get balance projections
- `PUT /api/forecasts/transactions/:id` - Edit transaction
- `DELETE /api/forecasts/transactions/:id` - Delete transaction
- `POST /api/forecasts/transactions/manual` - Add manual transaction

## Usage

1. Register/Login to create an account
2. Link your bank account via Plaid
3. Sync transactions from your account
4. Detect recurring patterns
5. Generate a forecast
6. Edit, delete, or add transactions as needed

## Database Models

- **User**: User accounts
- **Account**: Bank accounts from Plaid
- **Transaction**: Historical transactions
- **RecurringPattern**: Detected recurring patterns
- **ForecastTransaction**: Projected future transactions
- **Forecast**: Forecast snapshots

## Notes

- The recurring detection algorithm uses simple frequency analysis and merchant matching
- Forecasts are generated day-by-day based on recurring patterns
- Users can override any projected transaction
- Patterns can be set to end at a specific date
