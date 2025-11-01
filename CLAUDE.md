# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Photo Blender** is a real-time multiplayer guessing game where players upload photos and guess who took each photo. Built as a monorepo with separate backend (Node.js + Socket.IO) and frontend (React + TypeScript) applications.

**Current Status**: Production ready with 55 passing unit tests and recent security hardening (see `CRITICAL_SECURITY_FIXES.md`).

---

## Essential Commands

### Development

```bash
# Install dependencies (from root)
cd backend && npm install
cd ../frontend && npm install

# Run backend development server (port 5000)
cd backend && npm run dev

# Run frontend development server (port 3000)
cd frontend && npm start

# Run both concurrently (from root)
npm run dev:backend   # Terminal 1
npm run dev:frontend  # Terminal 2
```

### Testing

```bash
# Run all backend tests (55 unit tests)
cd backend && npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- helpers.test.js
npm test -- GameRoom.test.js
```

### Production Build

```bash
# Build frontend and prepare for production (from root)
npm run build

# Start production server (serves built frontend + backend API)
npm start
```

---

## Architecture Overview

### Real-Time Game Flow Architecture

The application uses a **hybrid HTTP + WebSocket architecture**:

1. **HTTP REST API** handles:
   - Room creation/joining (generates JWT tokens)
   - Photo uploads with compression
   - Game start/reset operations
   - Guess submission

2. **WebSocket (Socket.IO)** handles:
   - Real-time player presence
   - Live game state synchronization
   - Photo reveal events
   - Score updates and leaderboard

3. **Critical Security Layer** (as of 2025-11-01):
   - JWT authentication required for WebSocket connections
   - Token generated on `/api/join-room`, validated via Socket.IO middleware
   - Prevents player impersonation and unauthorized game manipulation

### Backend Structure (Refactored from 1,038 → 580 lines in server.js)

```
backend/
├── server.js                      # Main entry point (580 lines)
│   ├── HTTP routes (REST API)
│   ├── Socket.IO event handlers
│   ├── JWT authentication middleware
│   └── Game orchestration logic
│
├── src/
│   ├── config/
│   │   ├── cloudinary.js         # Cloud storage config with fail-fast validation
│   │   └── multer.js             # File upload config (10MB limit, image-only)
│   │
│   ├── middleware/
│   │   └── rateLimiter.js        # 4 different rate limiters by endpoint type
│   │
│   ├── models/
│   │   └── GameRoom.js           # Core game state management class
│   │       ├── Player tracking (Map<playerId, player>)
│   │       ├── Photo storage with metadata
│   │       ├── Scoring system (base + time bonus + streaks)
│   │       ├── Upload size tracking (per player & per room)
│   │       └── Cryptographic photo shuffling (crypto.randomInt)
│   │
│   ├── services/
│   │   └── FileCleanupService.js # Automatic cleanup of local/cloud photos
│   │
│   └── utils/
│       └── helpers.js            # XSS prevention, room code generation
│
└── uploads/                      # Local photo storage (fallback)
```

### Frontend Structure (Single-Page App)

```
frontend/src/
├── App.tsx          # Main component (1,144 lines)
│   ├── 27 useState hooks for game state
│   ├── Socket.IO connection management with JWT auth
│   ├── Game phase rendering (waiting → uploading → playing → finished)
│   ├── Photo upload with progress tracking
│   └── Real-time score display
│
├── index.tsx        # React entry point
└── index.css        # Glassmorphism styles with animations (889 lines)
```

**Note**: The frontend is currently monolithic (1,144 lines). When refactoring, consider extracting:
- WebSocket logic → custom hook
- Game phases → separate components
- State management → Context API or Zustand

### Game State Machine

```
WAITING (room lobby)
   ↓ (host clicks "Start Game")
PLAYING (photo rounds)
   ↓ (all photos shown)
FINISHED (final leaderboard)
   ↓ (host clicks "Play Again")
WAITING (reset to lobby, photos cleared)
```

**Critical Transitions**:
- `WAITING → PLAYING`: Requires ≥2 players, ≥10 photos total
- `PLAYING → FINISHED`: Auto-advances when last photo is shown
- Photos are shuffled using `crypto.randomInt()` (not `Math.random()`)

### Security Architecture (JWT WebSocket Authentication)

**Flow** (as of 2025-11-01 security fixes):

1. **Client joins room**:
   ```
   POST /api/join-room { roomCode, playerName }
   → Response: { playerId, token, ... }
   ```

2. **Client connects to WebSocket**:
   ```javascript
   io(BACKEND_URL, { auth: { token } })
   ```

3. **Server validates via middleware**:
   ```javascript
   io.use((socket, next) => {
     const decoded = jwt.verify(token, JWT_SECRET);
     socket.playerId = decoded.playerId;
     socket.roomCode = decoded.roomCode;
     next();
   });
   ```

4. **All socket events validate**:
   - `playerId` from client matches `socket.playerId` (authenticated)
   - `roomCode` from client matches `socket.roomCode` (authenticated)

**Environment Variables Required** (production):
- `JWT_SECRET`: Cryptographically secure secret (generate with `openssl rand -hex 64`)
- `FRONTEND_URL`: Exact origin for CORS (no default in production)
- `CLOUDINARY_*`: Cloud storage credentials (app fails fast if invalid)

---

## Key Implementation Details

### Photo Processing Pipeline

```
User uploads → Multer receives
  ↓
Validate: image MIME type, <10MB per file
  ↓
Check limits: <100MB per player, <500MB per room
  ↓
Sharp processing:
  - Auto-rotate from EXIF
  - Resize to 800×800 (fit inside)
  - Compress to JPEG quality 80
  - Strip ALL metadata (EXIF/GPS for privacy)
  ↓
Upload to Cloudinary (if configured) OR save locally
  ↓
Track compressed file size in GameRoom
  ↓
Emit 'photoUploaded' event to all players in room
```

**Security**: EXIF stripping prevents GPS coordinate and device info leakage.

### Scoring System Logic

Located in `backend/src/models/GameRoom.js`:

```javascript
Base score: 100 points (correct guess)

Time bonus (top 3 fastest only):
  1st place: +100 points
  2nd place: +50 points
  3rd place: +25 points

Streak bonus (after 3+ correct in a row):
  +10 points per streak level
  Example: 5 streak = +50 points total

Reset: Streak resets to 0 on incorrect guess
```

**Implementation**: `submitGuess()` method handles scoring, `getLeaderboard()` returns sorted by score.

### Room Lifecycle & Cleanup

**Three cleanup triggers**:

1. **All players disconnect** → Immediate cleanup
2. **Game finishes** → 10-minute delayed cleanup (allows "Play Again")
3. **Periodic cleanup** (NOT YET IMPLEMENTED) → Recommended: 30 min inactivity

**Cleanup actions** (`FileCleanupService`):
- Delete local files in `uploads/`
- Delete Cloudinary resources
- Remove room from `gameRooms` Map
- Clear all timers (`roundTimer`, `resultsTimer`, `cleanupTimer`)

**Race Condition Fix** (2025-11-01): Room code generation now atomically checks and sets to prevent duplicate rooms.

### Rate Limiting Strategy

Four rate limiter tiers in `backend/src/middleware/rateLimiter.js`:

```javascript
createRoomLimiter: 5 req/15min   // Prevent room spam
uploadLimiter:     20 req/15min  // Photos (20 × max per player)
guessLimiter:      100 req/15min // Gameplay (30sec rounds × players)
generalLimiter:    100 req/15min // Default for all other routes
```

**Implementation**: `express-rate-limit` with `trust proxy: 1` for Render.com deployment.

---

## Testing Philosophy

### Current Coverage
- **55 unit tests** (all passing)
- **Files tested**: `helpers.js` (16 tests), `GameRoom.js` (39 tests)
- **Framework**: Jest with default config

### What's Tested
1. **Security functions**:
   - Room code generation (cryptographic, uniqueness)
   - XSS prevention (sanitizePlayerName strips HTML/scripts)

2. **Game logic**:
   - Player management (add, remove, host reassignment)
   - Photo handling (add, shuffle with crypto.randomInt)
   - Scoring (correct/incorrect, streaks, leaderboard)
   - Game state transitions (canStartGame requirements)

### What's NOT Tested (TODO)
- HTTP endpoints (no integration tests)
- WebSocket events (no Socket.IO testing)
- File upload flow (end-to-end)
- JWT authentication flow

**To add integration tests**: Use Supertest for HTTP routes, socket.io-client for WebSocket tests.

---

## Common Pitfalls & Gotchas

### 1. Frontend WebSocket Authentication (BREAKING CHANGE)

**As of 2025-11-01**, WebSocket connections require JWT authentication. If frontend is not updated:

```typescript
// WRONG - will be rejected
const socket = io(BACKEND_URL);

// CORRECT - must include token
const token = localStorage.getItem('authToken');
const socket = io(BACKEND_URL, { auth: { token } });
```

**Fix checklist**:
- Store token from `/api/join-room` response
- Pass token in Socket.IO handshake `auth` object
- Handle `connect_error` events for auth failures

### 2. Environment Variables in Production

**Backend will crash on startup if missing**:
- `FRONTEND_URL` (no default in production)
- `JWT_SECRET` (no default in production)
- `CLOUDINARY_*` (fails fast if set to 'demo' or invalid)

**Development**: `JWT_SECRET` auto-generates, `FRONTEND_URL` defaults to `http://localhost:3000`.

### 3. GameRoom State Mutation

`GameRoom` class uses in-memory Maps (not immutable):

```javascript
// CORRECT - direct mutation
gameRoom.players.set(playerId, player);

// WRONG - don't reassign the Map
gameRoom.players = new Map(); // Breaks references elsewhere
```

**Reason**: Multiple functions hold references to the same `gameRoom` instance from `gameRooms` Map.

### 4. Timer Cleanup Required

Always clear timers before setting new ones:

```javascript
if (gameRoom.roundTimer) {
  clearTimeout(gameRoom.roundTimer);
}
gameRoom.roundTimer = setTimeout(...);
```

**Memory leak risk**: Forgotten timers prevent garbage collection of GameRoom objects.

### 5. Sharp Image Processing Gotchas

```javascript
// withMetadata(false) strips EXIF - REQUIRED for privacy
await sharp(inputPath)
  .rotate()              // Must come BEFORE resize
  .resize(800, 800)
  .withMetadata(false)   // Don't forget!
  .toFile(outputPath);
```

**Order matters**: `.rotate()` must come before `.resize()` to handle portrait/landscape correctly.

---

## Recent Changes (2025-11-01)

### Critical Security Fixes Applied

See `CRITICAL_SECURITY_FIXES.md` for full details. Summary:

1. **JWT WebSocket authentication** - Prevents player impersonation
2. **Upload size limits** - 100MB/player, 500MB/room (DoS prevention)
3. **Helmet.js security headers** - CSP, X-Frame-Options, etc.
4. **FRONTEND_URL validation** - Required in production (CORS safety)
5. **Crypto.randomInt** - Photo shuffling now cryptographically secure
6. **Race condition fix** - Room code generation atomicity

**Dependencies added**:
- `helmet@^8.1.0`
- `jsonwebtoken@^9.0.2`

**Breaking change**: Frontend must be updated to use JWT tokens for WebSocket connections.

---

## Production Deployment (Render.com)

### Build Process

1. **Install all dependencies**:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. **Build frontend**:
   ```bash
   cd frontend && npm run build
   # Creates frontend/build/ with static files
   ```

3. **Backend serves frontend**:
   ```javascript
   // In server.js (production mode)
   app.use(express.static(path.join(__dirname, '../frontend/build')));
   app.get('*', (req, res) => {
     res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
   });
   ```

### Environment Variables Checklist

**Required**:
- `NODE_ENV=production`
- `PORT=10000` (or Render's assigned port)
- `FRONTEND_URL=https://your-app.onrender.com`
- `JWT_SECRET=<64-char-hex>` (generate with `openssl rand -hex 64`)

**Optional** (cloud storage):
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

**Without Cloudinary**: Photos stored locally in `uploads/` directory (works but not ideal for multi-instance deployments).

### Health Check Endpoint

```bash
GET /api/health
# Returns: { status: 'OK', timestamp: '...' }
```

Configure Render.com health check to ping this endpoint.

---

## Development Workflow Best Practices

### When Adding Features

1. **Start with GameRoom model** if game logic changes
2. **Add tests first** for new utility functions (TDD)
3. **Update server.js** for new HTTP/WebSocket routes
4. **Update App.tsx** for new UI states
5. **Test manually** with 2+ browser tabs (multiplayer simulation)

### When Fixing Bugs

1. **Check browser console** for frontend errors
2. **Check backend logs** (`console.log` in server.js - TODO: replace with Winston)
3. **Verify Socket.IO events** in browser DevTools → Network → WS tab
4. **Add regression test** if unit-testable

### Code Style Notes

- **Backend**: JavaScript (ES6+), CommonJS modules (`require`)
- **Frontend**: TypeScript, React hooks (no class components)
- **Naming**: camelCase for variables/functions, PascalCase for classes/components
- **Comments**: JSDoc for public functions, inline for complex logic

---

## Future Refactoring Priorities

Based on code review (see repo docs), these are high-priority improvements:

1. **Split App.tsx** - Extract components: RoomLobby, GamePlay, Results, PhotoUploader
2. **Add Winston logging** - Replace console.log with structured logging
3. **Input validation** - Use express-validator (already installed but unused)
4. **Error handling** - Add global error handler middleware
5. **Frontend state management** - Extract WebSocket logic to custom hook

**Low priority** (working fine):
- TypeScript for backend (currently plain JS)
- Database integration (currently in-memory only)
- CSS Modules (currently global CSS)

---

## Quick Reference

### Important File Locations

- **Main server logic**: `backend/server.js:548-650` (Socket.IO handlers)
- **Game state class**: `backend/src/models/GameRoom.js`
- **Security functions**: `backend/src/utils/helpers.js` (XSS prevention)
- **Rate limiters**: `backend/src/middleware/rateLimiter.js`
- **Frontend main component**: `frontend/src/App.tsx`
- **Test files**: `backend/src/**/*.test.js`

### Port Configuration

- **Backend dev**: 5000 (configurable via `PORT` env)
- **Frontend dev**: 3000 (CRA default)
- **Production**: Single port (backend serves both API + static frontend)

### Git Branch Strategy

- **Main branch**: `master`
- **All tests must pass** before merging
- **Commit messages**: Include Claude Code attribution as per project convention

---

**Last Updated**: 2025-11-01 (after critical security fixes)
**Version**: 1.0.0 (production ready)
**Test Status**: ✅ 55/55 tests passing
