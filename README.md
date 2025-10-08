# 📸 Photo Roulette

A fun party game where players upload photos and guess whose photo is being displayed!

## How to Play

1. **Create a Game Room**: One player creates a new game room and shares the room code (becomes the host)
2. **Join the Game**: Other players join using the room code (2-8 players total)
3. **Upload Photos**: Each player uploads photos from their device (need 10+ total photos)
4. **Start Playing**: Once minimum requirements are met, the host starts the game
5. **Guess Away**: Players see random photos and guess who they belong to within 30 seconds
6. **Score Points**: Get points for correct guesses, with bonuses for speed and streaks!

## Features

- 🎮 Real-time multiplayer gameplay (up to 8 players)
- 📱 Mobile-first responsive design
- 🖼️ Automatic image compression and optimization (800x800px, 80% quality)
- 🏆 Advanced scoring with time bonuses and streak multipliers
- 🎯 Easy room creation and joining with unique room codes
- ⚡ WebSocket-powered real-time updates
- ⏱️ 30-second timer per photo with auto-skip when all submit
- ☁️ Cloudinary integration for scalable cloud storage
- 👑 Host permissions - only room creator can start games
- 📊 Live leaderboard with scores and streaks
- 🎨 Animated UI with progress bars and visual feedback

## Tech Stack

### Backend
- **Node.js** + **Express** - Server framework
- **Socket.io** - Real-time communication
- **Multer** - File upload handling
- **Sharp** - Image processing and compression
- **Cloudinary** - Cloud-based image storage and optimization
- **UUID** - Unique identifier generation

### Frontend
- **React** + **TypeScript** - UI framework
- **Socket.io-client** - Real-time communication
- **Axios** - HTTP client
- **CSS3** - Responsive styling with modern animations

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd photo-roulette
   ```

2. **Install dependencies**
   ```bash
   npm run build
   ```
   This installs dependencies for both frontend and backend.

3. **Configure environment variables (optional)**

   Create a `.env` file in the `backend/` directory for Cloudinary support:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   FRONTEND_URL=http://localhost:3000
   PORT=5000
   NODE_ENV=development
   ```

   Without Cloudinary configuration, photos will be stored locally in `backend/uploads/`.

### Running the Application

**Development Mode (run in separate terminals):**

```bash
# Terminal 1 - Backend server
npm run dev:backend

# Terminal 2 - Frontend development server
npm run dev:frontend
```

- Backend runs on http://localhost:5000
- Frontend runs on http://localhost:3000

**Production Mode:**

```bash
npm start
```

The production server serves both the API and frontend on http://localhost:5000

## Game Rules

- **Minimum Players**: 2 players required (max 8 players)
- **Minimum Photos**: At least 10 photos total (with at least 2 players having uploaded photos)
- **Time Limit**: 30 seconds per photo
- **Host Controls**: Only the room creator (host) can start the game
- **Auto-Skip**: When all players submit their guesses, the round ends early
- **Scoring System**:
  - Base points: 100 per correct guess
  - Time bonus: +10 to +100 points (faster answers earn more)
    - 0-5 seconds: +100 bonus
    - 5-15 seconds: +50 bonus
    - 15-25 seconds: +25 bonus
    - 25-30 seconds: +10 bonus
  - Streak multiplier: +10 points per streak level after reaching 3+ streak
- **Photo Requirements**: Images only, automatically compressed to 800x800px

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
│   ├── server.js          # Main server file with game logic
│   ├── package.json       # Backend dependencies
│   ├── .env              # Environment variables (optional)
│   └── uploads/          # Local photo storage (fallback)
├── frontend/
│   ├── src/
│   │   ├── App.tsx       # Main React component
│   │   ├── index.tsx     # React entry point
│   │   └── index.css     # Global styles with animations
│   ├── public/
│   │   ├── index.html    # HTML template
│   │   └── manifest.json # PWA manifest
│   ├── package.json      # Frontend dependencies
│   └── tsconfig.json     # TypeScript configuration
├── package.json           # Root scripts for dev/build
├── render.yaml           # Render deployment configuration
└── README.md
```

## 📱 Mobile App (Flutter)

A native Flutter mobile app is available in the `mobile/` directory (on the `flutter-frontend` branch):

**Features:**
- ✅ Native iOS & Android apps
- ✅ Full camera access - take photos directly
- ✅ Native gallery access with proper permissions
- ✅ Same real-time multiplayer gameplay
- ✅ Connects to the same Node.js backend

**Quick Start:**
```bash
# Switch to flutter-frontend branch
git checkout flutter-frontend

# Navigate to mobile directory
cd mobile

# Install dependencies
flutter pub get

# Run on Android/iOS
flutter run
```

See `mobile/README.md` for complete Flutter setup instructions.

## Future Enhancements

- [ ] Database integration for persistent game history
- [ ] User accounts and profiles
- [ ] Custom game settings (configurable timer, rounds, etc.)
- [ ] Photo categories and themes
- [ ] Private/public room options
- [ ] Spectator mode
- [ ] Photo reactions and comments
- [ ] Tournament mode
- [ ] Native mobile app for better photo access

## Deployment

### Render Deployment

This project is configured for deployment on [Render](https://render.com) using the included `render.yaml` configuration.

**Setup:**

1. Push your code to a Git repository (GitHub, GitLab, etc.)
2. Connect your repository to Render
3. Render will automatically detect the `render.yaml` configuration
4. Set the following environment variables in Render dashboard:
   - `CLOUDINARY_CLOUD_NAME` (optional)
   - `CLOUDINARY_API_KEY` (optional)
   - `CLOUDINARY_API_SECRET` (optional)
   - `NODE_ENV=production`
   - `PORT=10000`

The deployment will:
- Build the frontend (`npm run build`)
- Install backend dependencies
- Serve both frontend and backend from a single service

**Render Configuration** (render.yaml):
```yaml
services:
  - type: web
    name: photo-roulette
    env: node
    region: frankfurt
    plan: free
    buildCommand: cd frontend && npm install && npm run build && cd ../backend && npm install
    startCommand: cd backend && npm start
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
