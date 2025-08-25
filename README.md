# 📸 Photo Roulette

A fun party game where players upload photos and guess whose photo is being displayed!

## How to Play

1. **Create a Game Room**: One player creates a new game room and shares the room code
2. **Join the Game**: Other players join using the room code
3. **Upload Photos**: Each player uploads photos from their device
4. **Start Playing**: Once enough photos are uploaded, start the game
5. **Guess Away**: Players see random photos and guess who they belong to
6. **Score Points**: Get points for correct guesses and see who wins!

## Features

- 🎮 Real-time multiplayer gameplay
- 📱 Mobile-first responsive design
- 🖼️ Automatic image compression and optimization
- 🏆 Live scoring and leaderboards
- 🎯 Easy room creation and joining
- ⚡ WebSocket-powered real-time updates

## Tech Stack

### Backend
- **Node.js** + **Express** - Server framework
- **Socket.io** - Real-time communication
- **Multer** - File upload handling
- **Sharp** - Image processing and compression
- **SQLite** - Lightweight database (future enhancement)

### Frontend
- **React** + **TypeScript** - UI framework
- **Socket.io-client** - Real-time communication
- **Axios** - HTTP client
- **CSS3** - Responsive styling with modern features

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd photo-roulette
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   The server will start on http://localhost:5000

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm start
   ```
   The app will open on http://localhost:3000

### Production Build

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Serve the production build**
   ```bash
   cd backend
   npm start
   ```

## Game Rules

- **Minimum Players**: 2 players required
- **Minimum Photos**: 5 photos total needed to start
- **Time Limit**: 30 seconds per photo (configurable)
- **Scoring**: 100 points per correct guess
- **Photo Requirements**: Images only, automatically compressed

## API Endpoints

### Game Management
- `POST /api/create-room` - Create a new game room
- `POST /api/join-room` - Join an existing game room
- `POST /api/start-game` - Start the game (host only)

### Photo Management
- `POST /api/upload-photo` - Upload a photo for the game
- `GET /uploads/:filename` - Serve uploaded photos

### Gameplay
- `POST /api/submit-guess` - Submit a guess for the current photo

### WebSocket Events
- `joinRoom` - Join a game room
- `gameState` - Receive current game state
- `playerJoined/playerLeft` - Player connection updates
- `photoUploaded` - Photo upload notifications
- `gameStarted` - Game start notification
- `newPhoto` - New photo to guess
- `photoResults` - Results after each round
- `gameFinished` - Final results

## File Structure

```
photo-roulette/
├── backend/
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   ├── .env              # Environment variables
│   └── uploads/          # Uploaded photos storage
├── frontend/
│   ├── src/
│   │   ├── App.tsx       # Main React component
│   │   ├── index.tsx     # React entry point
│   │   └── index.css     # Global styles
│   ├── public/
│   │   ├── index.html    # HTML template
│   │   └── manifest.json # PWA manifest
│   ├── package.json      # Frontend dependencies
│   └── tsconfig.json     # TypeScript configuration
└── README.md
```

## Mobile App Development

For native mobile functionality (camera access, gallery permissions), consider building:

1. **React Native App** - Simple client that handles photo uploads
2. **Flutter App** - Cross-platform mobile client
3. **PWA Enhancement** - Add service worker and native API access

The mobile app would:
- Handle photo gallery access and permissions
- Upload photos to the web API
- Redirect to the web game for gameplay
- Provide native camera capture functionality

## Future Enhancements

- [ ] Database integration for persistent game history
- [ ] User accounts and profiles
- [ ] Custom game settings (timer, rounds, etc.)
- [ ] Photo categories and themes
- [ ] Private/public room options
- [ ] Spectator mode
- [ ] Photo reactions and comments
- [ ] Tournament mode
- [ ] Native mobile app for better photo access

## Deployment

### Heroku Deployment
1. Create a Heroku app
2. Set environment variables
3. Deploy the backend
4. Configure static file serving for frontend

### Docker Deployment
```dockerfile
# Dockerfile example for backend
FROM node:16
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - feel free to use this project for your own purposes!

## Support

For issues or questions, please create an issue in the repository or contact the development team.

---

**Have fun playing Photo Roulette! 📸🎮**
