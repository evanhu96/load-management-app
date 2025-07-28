
// =====================================
// remote-client/src/uninstall-service.js
// =====================================

const { Service } = require('node-windows');
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'Load Data Collector',
  script: path.join(__dirname, 'dataCollector.js')
});

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall', () => {
  console.log('Load Data Collector service uninstalled successfully');
});

svc.on('error', (err) => {
  console.error('Service error:', err);
});

// Uninstall the service
console.log('Uninstalling Load Data Collector service...');
svc.uninstall();
