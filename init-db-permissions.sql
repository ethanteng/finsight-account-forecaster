-- Grant connection permission to postgres database (Prisma migrations need this)
GRANT CONNECT ON DATABASE postgres TO finsight;

-- Ensure user owns the target database
ALTER DATABASE finsight_account_forecaster OWNER TO finsight;

-- Grant all privileges on the target database
GRANT ALL PRIVILEGES ON DATABASE finsight_account_forecaster TO finsight;
