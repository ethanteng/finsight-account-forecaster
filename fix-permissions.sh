#!/bin/bash
# Script to fix database permissions

echo "Connecting to database and granting permissions..."

docker exec -i finsight-account-forecaster-postgres psql -U finsight -d finsight_account_forecaster <<EOF
-- Grant schema privileges
GRANT ALL ON SCHEMA public TO finsight;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO finsight;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO finsight;

-- Verify permissions
\du finsight
\l finsight_account_forecaster
EOF

echo "Done!"
