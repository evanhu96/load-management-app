
// =====================================
// remote-client/src/install-service.js
// =====================================

const { Service } = require('node-windows');
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'Load Data Collector',
  description: 'Collects and syncs load data to the management server',
  script: path.join(__dirname, 'dataCollector.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    },
    {
      name: "SERVER_URL",
      value: process.env.SERVER_URL || "http://localhost:3001"
    }
  ]
});

// Listen for the "install" event, which indicates the process is available as a service.
svc.on('install', () => {
  console.log('Load Data Collector service installed successfully');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', () => {
  console.log('Load Data Collector service started');
});

svc.on('error', (err) => {
  console.error('Service error:', err);
});

// Install the service
console.log('Installing Load Data Collector as Windows service...');
svc.install();
