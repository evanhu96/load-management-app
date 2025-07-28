
// =====================================
// remote-client/src/test.js
// =====================================

const { LoadDataCollector } = require('./dataCollector');
const fs = require('fs').promises;
const path = require('path');

async function createTestData() {
  const testData = {
    "Test Load 1": {
      hash: "test-load-1",
      rate: 1500,
      origin: "Cleveland,OH",
      destination: "Baltimore,MD",
      dates: "7/15",
      company: "Test Company",
      contact: "(555) 123-4567",
      trip: "TEST001",
      dho: "25",
      dhd: "50",
      truck: 1,
      website: "TEST"
    },
    "Test Load 2": {
      hash: "test-load-2",
      rate: "$2,000",
      origin: "Detroit,MI",
      destination: "Washington,DC",
      dates: "7/16",
      company: "Another Test Co",
      contact: "(555) 987-6543",
      trip: "TEST002",
      dho: "30",
      dhd: "40",
      truck: 2,
      website: "TEST"
    }
  };

  const testFile = path.join(__dirname, '..', 'test-loads.json');
  await fs.writeFile(testFile, JSON.stringify(testData, null, 2));
  console.log(`Test data created at: ${testFile}`);
  return testFile;
}

async function runTest() {
  console.log('Starting Load Data Collector Test...\n');

  try {
    // Create test data
    const testFile = await createTestData();

    // Create collector with test configuration
    const collector = new LoadDataCollector({
      serverUrl: process.env.SERVER_URL || 'http://localhost:3001',
      watchPaths: [testFile],
      retryInterval: 2000,
      maxRetries: 3
    });

    // Test connection
    console.log('Testing server connection...');
    const fetch = require('node-fetch');
    try {
      const response = await fetch(`${collector.config.serverUrl}/api/health`);
      if (response.ok) {
        console.log('✓ Server is reachable\n');
      } else {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      console.log('✗ Server connection failed:', error.message);
      console.log('Make sure the backend server is running on', collector.config.serverUrl);
      return;
    }

    // Initialize collector
    console.log('Initializing collector...');
    await collector.initialize();

    // Wait for initial processing
    console.log('Waiting for file processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Show stats
    const stats = collector.getStats();
    console.log('\n--- Test Results ---');
    console.log(`Connected: ${stats.isConnected}`);
    console.log(`Files watched: ${stats.watchedFiles.length}`);
    console.log(`Loads processed: ${stats.totalLoadsProcessed}`);
    console.log(`Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach(error => {
        console.log(`- ${error.message}`);
      });
    }

    // Cleanup
    console.log('\nCleaning up...');
    await collector.shutdown();
    await fs.unlink(testFile);
    console.log('Test completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  runTest();
}

module.exports = { runTest, createTestData };