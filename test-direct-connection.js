// Test direct PostgreSQL connection using pg library
const { Client } = require('pg');
require('dotenv').config();

async function testDirectConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Attempting to connect...');
    console.log('Connection string:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));
    
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT current_database(), current_user, version()');
    console.log('\nDatabase info:');
    console.log('  Database:', result.rows[0].current_database);
    console.log('  User:', result.rows[0].current_user);
    console.log('  PostgreSQL version:', result.rows[0].version.split(',')[0]);
    
    // Test creating a table (what Prisma would do)
    await client.query('CREATE TABLE IF NOT EXISTS _prisma_migrations_test (id SERIAL PRIMARY KEY)');
    console.log('\n✅ Can create tables!');
    await client.query('DROP TABLE IF EXISTS _prisma_migrations_test');
    console.log('✅ Can drop tables!');
    
  } catch (error) {
    console.error('\n❌ Connection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

testDirectConnection();
