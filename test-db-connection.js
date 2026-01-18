// Test script to verify database connection string
require('dotenv').config();

function testConnectionString() {
  console.log('=== Environment Variable Check ===');
  console.log('DATABASE_URL from .env:', process.env.DATABASE_URL);
  console.log('\n=== Parsed URL Parts ===');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set!');
    return;
  }
  
  const dbUrl = process.env.DATABASE_URL;
  
  // Check for quotes
  if (dbUrl.startsWith('"') && dbUrl.endsWith('"')) {
    console.warn('⚠️  WARNING: DATABASE_URL has quotes around it!');
    console.warn('   Remove quotes from .env file');
  }
  
  try {
    const url = new URL(dbUrl);
    console.log('  Protocol:', url.protocol);
    console.log('  Username:', url.username);
    console.log('  Password:', url.password ? '***' : '(none)');
    console.log('  Hostname:', url.hostname);
    console.log('  Port:', url.port || '(default)');
    console.log('  Database:', url.pathname.substring(1));
    console.log('  Search params:', url.search);
    
    const expectedDb = 'finsight_account_forecaster';
    const actualDb = url.pathname.substring(1);
    
    console.log('\n=== Validation ===');
    if (actualDb === expectedDb) {
      console.log('✅ Database name matches expected:', expectedDb);
    } else {
      console.error('❌ Database name mismatch!');
      console.error('   Expected:', expectedDb);
      console.error('   Actual:', actualDb);
    }
    
    if (url.username === 'finsight') {
      console.log('✅ Username matches expected: finsight');
    } else {
      console.error('❌ Username mismatch! Expected: finsight, Got:', url.username);
    }
    
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      console.log('✅ Hostname is correct:', url.hostname);
    } else {
      console.warn('⚠️  Hostname:', url.hostname, '(expected localhost or 127.0.0.1)');
    }
    
  } catch (error) {
    console.error('❌ Failed to parse DATABASE_URL:');
    console.error('   Error:', error.message);
    console.error('   URL:', dbUrl);
  }
}

testConnectionString();
