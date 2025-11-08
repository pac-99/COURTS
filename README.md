# CourtCheck - Find your game. Anytime.

CourtCheck is a mobile-first web application that helps players instantly see how busy local sports courts are by combining crowdsourced reports and AI-enhanced camera data.

## Features

### Core Features (MVP v1)
- **Interactive Map**: View nearby courts with real-time availability status
- **Crowdsourced Check-ins**: Users can report crowd levels (1-5 scale) with photos/videos
- **AI Camera Integration**: Real-time occupancy detection using computer vision
- **User Accounts**: Sign in with Google/Apple, track history and favorites
- **Analytics**: Daily/weekly busy hours charts and occupancy trends
- **Gamification**: Points, badges, and reputation system

### Sports Supported
- Basketball
- Tennis
- Pickleball
- Soccer
- Volleyball
- Badminton

## Tech Stack

### Backend
- **Node.js/Express**: RESTful API server
- **MongoDB**: Document database with geospatial indexing
- **JWT**: Authentication and authorization
- **Multer**: File upload handling
- **Socket.io**: Real-time updates (future)

### Frontend
- **Vanilla JavaScript**: Modern ES6+ with classes and modules
- **Google Maps API**: Interactive maps and location services
- **Chart.js**: Analytics and data visualization
- **CSS Grid/Flexbox**: Responsive design
- **PWA Ready**: Service worker and offline capabilities

### AI/ML
- **TensorFlow Lite**: Lightweight occupancy detection
- **OpenCV**: Computer vision processing
- **RTSP/HTTP**: Camera feed integration

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- MongoDB (local or Atlas)
- Google Maps API key
- Google OAuth credentials

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd courtcheck
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and database URL
   ```

3. **Database setup**
   ```bash
   # Start MongoDB (if local)
   mongod
   
   # Seed sample data
   node seed-data.js
   ```

4. **Start the server**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5000
   ```

## API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/apple` - Apple OAuth login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Courts
- `GET /api/courts/nearby` - Get nearby courts
- `GET /api/courts/:id` - Get court details
- `POST /api/courts` - Create new court
- `GET /api/courts/search/:query` - Search courts

### Check-ins
- `POST /api/checkins` - Create check-in
- `GET /api/checkins/court/:courtId` - Get court check-ins
- `GET /api/checkins/my` - Get user's check-ins
- `POST /api/checkins/:id/helpful` - Rate check-in helpful

### Camera/AI
- `POST /api/camera/data` - Receive AI camera data
- `GET /api/camera/data/:courtId` - Get camera data
- `POST /api/camera/simulate` - Simulate camera data

### Analytics
- `GET /api/analytics/court/:courtId` - Court analytics
- `GET /api/analytics/user/:userId` - User analytics
- `GET /api/analytics/global` - Global analytics

## Data Models

### User
```javascript
{
  name: String,
  email: String,
  profilePicture: String,
  location: { type: "Point", coordinates: [lng, lat] },
  reputationScore: Number,
  totalCheckIns: Number,
  badges: [String],
  favoriteCourts: [ObjectId],
  preferences: {
    sports: [String],
    notifications: Boolean,
    radius: Number
  }
}
```

### Court
```javascript
{
  name: String,
  description: String,
  location: { type: "Point", coordinates: [lng, lat] },
  address: String,
  sportType: String,
  amenities: [String],
  operatingHours: Object,
  cameraFeed: {
    url: String,
    type: String,
    isActive: Boolean
  },
  currentStatus: {
    crowdLevel: Number, // 1-5
    lastUpdated: Date,
    source: String // "user", "ai", "hybrid"
  },
  rating: { average: Number, count: Number }
}
```

### CheckIn
```javascript
{
  user: ObjectId,
  court: ObjectId,
  crowdLevel: Number, // 1-5
  comment: String,
  media: [{ type: String, url: String }],
  weather: Object,
  duration: Number,
  helpful: [ObjectId],
  notHelpful: [ObjectId]
}
```

## Development

### Project Structure
```
courtcheck/
├── models/           # MongoDB schemas
├── routes/           # API route handlers
├── middleware/       # Express middleware
├── uploads/          # File uploads
├── seed-data.js      # Sample data
├── server.js         # Main server file
├── index.html        # Frontend entry point
├── styles.css        # CSS styles
├── app.js           # Frontend JavaScript
└── package.json     # Dependencies
```

### Adding New Features

1. **New API endpoint**: Add route in `routes/` directory
2. **New data model**: Create schema in `models/` directory
3. **Frontend feature**: Add to `app.js` and update `index.html`
4. **Styling**: Update `styles.css` with new components

### Testing

```bash
# Run backend tests
npm test

# Test API endpoints
curl http://localhost:5000/api/health
```

## Deployment

### Environment Variables
```bash
MONGODB_URI=mongodb://localhost:27017/courtcheck
JWT_SECRET=your_jwt_secret
GOOGLE_MAPS_API_KEY=your_google_maps_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
PORT=5000
NODE_ENV=production
```

### Production Deployment
1. Set up MongoDB Atlas or production MongoDB
2. Configure environment variables
3. Deploy to Heroku, AWS, or your preferred platform
4. Set up SSL certificate
5. Configure domain and DNS

## AI/Camera Integration

### Camera Setup
1. Install cameras at court locations
2. Configure RTSP/HTTP streams
3. Set up AI processing service
4. Update court records with camera URLs

### AI Processing
```javascript
// Example AI data processing
{
  courtId: "court123",
  occupancyCount: 8,
  confidence: 0.85,
  crowdLevel: 3,
  imageUrl: "https://storage.com/processed-image.jpg",
  processingTime: 1200,
  metadata: {
    weather: "sunny",
    timeOfDay: "afternoon",
    lighting: "good"
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Email: support@courtcheck.com
- Documentation: https://docs.courtcheck.com
- Issues: GitHub Issues

## Roadmap

### v1.1 (Next Release)
- Push notifications
- Social features (friends, groups)
- Advanced filtering
- Court reservations

### v1.2 (Future)
- Mobile app (React Native)
- Partner dashboard
- Payment integration
- Tournament management

---

**CourtCheck** - Find your game. Anytime. 🏀⚽🎾