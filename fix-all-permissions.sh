#!/bin/bash
# Fix all database permissions for Prisma

echo "Granting permissions to finsight user..."

docker exec -i finsight-account-forecaster-postgres psql -U postgres <<EOF
-- Grant connection permission to postgres database (Prisma sometimes needs this)
GRANT CONNECT ON DATABASE postgres TO finsight;

-- Ensure user owns the target database
ALTER DATABASE finsight_account_forecaster OWNER TO finsight;

-- Grant all privileges on the target database
GRANT ALL PRIVILEGES ON DATABASE finsight_account_forecaster TO finsight;
EOF

echo "Connecting to target database to grant schema permissions..."

docker exec -i finsight-account-forecaster-postgres psql -U finsight -d finsight_account_forecaster <<EOF
-- Grant schema privileges
GRANT ALL ON SCHEMA public TO finsight;
ALTER SCHEMA public OWNER TO finsight;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO finsight;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO finsight;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO finsight;

-- Verify
SELECT current_database(), current_user;
\du finsight
EOF

echo "Done! Try running 'npx prisma migrate dev' again."
