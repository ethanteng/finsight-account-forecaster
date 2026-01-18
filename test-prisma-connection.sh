#!/bin/bash
# Test different connection string formats with Prisma

echo "=== Testing Prisma connection with different formats ==="

# Test 1: Current format
echo -e "\n1. Testing current format (postgresql://...):"
DATABASE_URL="postgresql://finsight:finsight_password@localhost:5432/finsight_account_forecaster?schema=public" npx prisma db pull --print 2>&1 | head -10

# Test 2: With sslmode=disable
echo -e "\n2. Testing with sslmode=disable:"
DATABASE_URL="postgresql://finsight:finsight_password@localhost:5432/finsight_account_forecaster?schema=public&sslmode=disable" npx prisma db pull --print 2>&1 | head -10

# Test 3: Using postgres:// instead of postgresql://
echo -e "\n3. Testing with postgres:// protocol:"
DATABASE_URL="postgres://finsight:finsight_password@localhost:5432/finsight_account_forecaster?schema=public" npx prisma db pull --print 2>&1 | head -10

# Test 4: Without schema parameter
echo -e "\n4. Testing without schema parameter:"
DATABASE_URL="postgresql://finsight:finsight_password@localhost:5432/finsight_account_forecaster" npx prisma db pull --print 2>&1 | head -10
