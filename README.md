
# Load Management System

A comprehensive trucking load management system with real-time updates, profit calculations, and SMS alerts.

## 🚛 Features

- **Real-time Load Tracking**: WebSocket-based live updates
- **Profit Calculations**: Automatic profit analysis based on truck-specific costs
- **SMS Alerts**: Twilio integration for high-profit load notifications
- **Truck Management**: Separate configurations for multiple trucks
- **Remote Data Collection**: Automatic file monitoring and sync
- **Responsive UI**: Modern React interface with sorting and filtering
- **RESTful API**: Complete backend with SQLite database

## 🏗️ Architecture

```
├── backend/          # Node.js/Express API server
├── frontend/         # React web application  
├── remote-client/    # File watcher for remote data collection
└── nginx/           # Reverse proxy configuration
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Twilio account (for SMS alerts)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd load-management-system
```

2. **Backend Setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

3. **Frontend Setup**
```bash
cd frontend
npm install
npm start
```

4. **Remote Client Setup** (on your data collection laptop)
```bash
cd remote-client
npm install
cp .env.example .env
# Edit .env with server URL
npm start
```

### Docker Deployment

```bash
# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

## 📝 Configuration

### Truck Settings
Configure in the web interface:
- Miles per gallon (MPG)
- Fuel cost per gallon
- Operating cost per mile
- Alert profit threshold
- Alert mile threshold

### SMS Alerts
Set in `.env`:
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890
ALERT_PHONE_NUMBER=+1987654321
```

### File Watching
The remote client monitors:
- `loads.json`
- `tsLoads.json`
- Custom paths you configure

## 🔌 API Endpoints

### Loads
- `GET /api/loads` - Get all loads
- `POST /api/loads` - Add single load
- `POST /api/loads/bulk` - Bulk import
- `PUT /api/loads/:hash` - Update load
- `DELETE /api/loads/:hash` - Delete load

### Configuration
- `GET /api/trucks/:id/config` - Get truck config
- `PUT /api/trucks/:id/config` - Update truck config

### Alerts
- `GET /api/alerts` - Get alert history
- `POST /api/alerts/test` - Send test alert

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests  
cd frontend
npm test

# Remote client test
cd remote-client
npm run test
```

## 📊 Monitoring

- Health check: `GET /api/health`
- Logs: `docker-compose logs -f`
- Stats: Available in the web interface

## 🔒 Security

- API key authentication
- Rate limiting
- Input validation
- CORS configuration
- Helmet.js security headers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License
