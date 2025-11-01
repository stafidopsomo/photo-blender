const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

// Import refactored modules
const { configureCloudinary, cloudinary } = require('./src/config/cloudinary');
const { configureMulter } = require('./src/config/multer');
const { createRoomLimiter, uploadLimiter, guessLimiter, generalLimiter } = require('./src/middleware/rateLimiter');
const { generateRoomCode, sanitizePlayerName } = require('./src/utils/helpers');
const GameRoom = require('./src/models/GameRoom');
const FileCleanupService = require('./src/services/FileCleanupService');

// Configure Cloudinary (with production validation)
configureCloudinary();

// JWT Secret for WebSocket authentication
// In production, this MUST be set in environment variables
const JWT_SECRET = process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET environment variable must be set in production'); })()
    : crypto.randomBytes(64).toString('hex')); // Auto-generate for dev

console.log('JWT authentication configured');

// Validate FRONTEND_URL in production
const FRONTEND_URL = process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('FRONTEND_URL environment variable must be set in production'); })()
    : "http://localhost:3000");

console.log(`CORS configured for origin: ${FRONTEND_URL}`);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// Trust proxy - Required for Render.com and other reverse proxies
// This allows rate limiters to correctly identify users by IP
app.set('trust proxy', 1);

// Middleware
// Security headers with Helmet.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"], // Allow Cloudinary images
      connectSrc: ["'self'", FRONTEND_URL], // Allow WebSocket connections
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow cross-origin resources
}));

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const upload = configureMulter(uploadsDir);

// Game state management
const gameRooms = new Map();
const playerSockets = new Map();

// Initialize file cleanup service
const fileCleanupService = new FileCleanupService(uploadsDir, gameRooms);

// ===== API ROUTES =====

// Create a new game room
app.post('/api/create-room', createRoomLimiter, (req, res) => {
  let roomCode;
  let gameRoom;
  let attempts = 0;
  const MAX_ATTEMPTS = 10;

  // Atomically generate and reserve room code to prevent race conditions
  while (attempts < MAX_ATTEMPTS) {
    roomCode = generateRoomCode();
    attempts++;

    // Atomically check and set to prevent race condition
    if (!gameRooms.has(roomCode)) {
      gameRoom = new GameRoom(roomCode);
      gameRooms.set(roomCode, gameRoom);
      break;
    }
  }

  if (!gameRoom) {
    return res.status(500).json({ error: 'Failed to generate unique room code. Please try again.' });
  }

  console.log(`Room created: ${roomCode}, Total rooms: ${gameRooms.size}`);
  res.json({ roomCode });
});

// Join a game room
app.post('/api/join-room', generalLimiter, (req, res) => {
  const { roomCode, playerName } = req.body;

  if (!roomCode || !playerName) {
    return res.status(400).json({ error: 'Room code and player name are required' });
  }

  const sanitizedName = sanitizePlayerName(playerName);

  if (!sanitizedName || sanitizedName.length === 0) {
    return res.status(400).json({ error: 'Please enter a valid name (letters and numbers only)' });
  }

  if (sanitizedName.length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters long' });
  }

  const gameRoom = gameRooms.get(roomCode.toUpperCase());
  if (!gameRoom) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (gameRoom.players.size >= gameRoom.gameSettings.maxPlayers) {
    return res.status(400).json({ error: 'Room is full' });
  }

  if (gameRoom.gameState !== 'waiting') {
    return res.status(400).json({ error: 'Game already in progress' });
  }

  const playerId = uuidv4();
  const isHost = gameRoom.players.size === 0 || !gameRoom.hostId;

  if (isHost) {
    gameRoom.hostId = playerId;
  }

  // Generate JWT token for WebSocket authentication
  const token = jwt.sign(
    {
      playerId,
      roomCode: gameRoom.roomCode,
      playerName: sanitizedName
    },
    JWT_SECRET,
    { expiresIn: '24h' } // Token expires in 24 hours
  );

  res.json({
    playerId,
    roomCode: gameRoom.roomCode,
    gameState: gameRoom.gameState,
    isHost,
    sanitizedName,
    token // Send token to client for WebSocket authentication
  });
});

// Upload photo
app.post('/api/upload-photo', uploadLimiter, upload.single('photo'), async (req, res) => {
  try {
    const { roomCode, playerId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const gameRoom = gameRooms.get(roomCode?.toUpperCase());
    if (!gameRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const player = gameRoom.players.get(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found in room' });
    }

    // Upload limits to prevent DoS attacks
    const MAX_PHOTOS_PER_PLAYER = 20;
    const MAX_UPLOAD_SIZE_PER_PLAYER = 100 * 1024 * 1024; // 100MB per player
    const MAX_UPLOAD_SIZE_PER_ROOM = 500 * 1024 * 1024; // 500MB per room

    if (player.photosUploaded >= MAX_PHOTOS_PER_PLAYER) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `Maximum ${MAX_PHOTOS_PER_PLAYER} photos per player` });
    }

    // Check player upload size limit
    if (player.totalUploadSize + req.file.size > MAX_UPLOAD_SIZE_PER_PLAYER) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: `Total upload size limit exceeded. Maximum ${MAX_UPLOAD_SIZE_PER_PLAYER / (1024 * 1024)}MB per player`
      });
    }

    // Check room upload size limit
    if (gameRoom.totalUploadSize + req.file.size > MAX_UPLOAD_SIZE_PER_ROOM) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: `Room upload limit exceeded. Maximum ${MAX_UPLOAD_SIZE_PER_ROOM / (1024 * 1024)}MB per room`
      });
    }

    // Compress, resize, and strip EXIF metadata for privacy
    const compressedPath = path.join(uploadsDir, 'compressed-' + req.file.filename);
    await sharp(req.file.path)
      .rotate() // Auto-rotate based on EXIF, then strip metadata
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .withMetadata(false) // Strip all metadata including EXIF, GPS
      .toFile(compressedPath);

    fs.unlinkSync(req.file.path);

    // Get compressed file size for tracking
    const compressedStats = fs.statSync(compressedPath);
    const compressedSize = compressedStats.size;

    // Upload to Cloudinary
    let photoUrl = `/uploads/${path.basename(compressedPath)}`;

    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'demo') {
      try {
        const result = await cloudinary.uploader.upload(compressedPath, {
          folder: 'photo-roulette',
          resource_type: 'image',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto:good' }
          ]
        });
        photoUrl = result.secure_url;
        fs.unlinkSync(compressedPath);
      } catch (cloudError) {
        console.error('Cloudinary upload failed, using local storage:', cloudError);
      }
    }

    gameRoom.addPhoto(playerId, photoUrl, compressedSize);

    io.to(roomCode.toUpperCase()).emit('photoUploaded', {
      playerName: player.name,
      totalPhotos: gameRoom.photos.length,
      canStartGame: gameRoom.canStartGame()
    });

    const fullGameState = {
      gameState: gameRoom.gameState,
      players: Array.from(gameRoom.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        photosUploaded: p.photosUploaded,
        isHost: p.isHost
      })),
      totalPhotos: gameRoom.photos.length,
      canStartGame: gameRoom.canStartGame(),
      hostId: gameRoom.hostId
    };
    io.to(roomCode.toUpperCase()).emit('gameState', fullGameState);

    res.json({
      message: 'Photo uploaded successfully',
      totalPhotos: gameRoom.photos.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Start game
app.post('/api/start-game', generalLimiter, (req, res) => {
  const { roomCode, playerId } = req.body;

  const gameRoom = gameRooms.get(roomCode?.toUpperCase());
  if (!gameRoom) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (playerId !== gameRoom.hostId) {
    return res.status(403).json({ error: 'Only the host can start the game' });
  }

  if (!gameRoom.canStartGame()) {
    return res.status(400).json({ error: 'Cannot start game yet. Need at least 2 players and 10 total photos.' });
  }

  gameRoom.gameState = 'playing';
  gameRoom.shufflePhotos();
  gameRoom.currentPhotoIndex = 0;

  io.to(roomCode.toUpperCase()).emit('gameStarted', {
    totalPhotos: gameRoom.photos.length,
    players: Array.from(gameRoom.players.values()).map(p => ({
      id: p.id,
      name: p.name
    }))
  });

  setTimeout(() => {
    showNextPhoto(gameRoom);
  }, 2000);

  res.json({ message: 'Game started!' });
});

// Submit guess
app.post('/api/submit-guess', guessLimiter, (req, res) => {
  const { roomCode, playerId, guessedPlayerId, timeToAnswer } = req.body;

  const gameRoom = gameRooms.get(roomCode?.toUpperCase());

  if (!gameRoom) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Validate playerId belongs to this room
  if (!playerId || !gameRoom.players.has(playerId)) {
    return res.status(403).json({ error: 'Invalid player or player not in room' });
  }

  gameRoom.submitGuess(playerId, guessedPlayerId, timeToAnswer || 30);

  const currentPhoto = gameRoom.getCurrentPhoto();
  const totalPlayers = gameRoom.players.size;
  const submittedGuesses = currentPhoto.guesses.size;

  if (submittedGuesses === totalPlayers) {
    if (gameRoom.roundTimer) {
      clearTimeout(gameRoom.roundTimer);
      gameRoom.roundTimer = null;
    }
    showPhotoResults(gameRoom);
  }

  res.json({ message: 'Guess submitted' });
});

// Reset game (Play Again)
app.post('/api/reset-game', generalLimiter, (req, res) => {
  const { roomCode, playerId } = req.body;

  const gameRoom = gameRooms.get(roomCode?.toUpperCase());
  if (!gameRoom) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (playerId !== gameRoom.hostId) {
    return res.status(403).json({ error: 'Only the host can reset the game' });
  }

  // Prevent immediate reset - ensure players see final results for at least 3 seconds
  if (!gameRoom.gameFinishedTime) {
    gameRoom.gameFinishedTime = Date.now();
  }
  const timeSinceFinish = Date.now() - gameRoom.gameFinishedTime;
  if (timeSinceFinish < 3000) {
    return res.status(429).json({
      error: 'Please wait a moment before resetting',
      waitTime: Math.ceil((3000 - timeSinceFinish) / 1000)
    });
  }

  // Clear all timers
  if (gameRoom.roundTimer) clearTimeout(gameRoom.roundTimer);
  if (gameRoom.resultsTimer) clearTimeout(gameRoom.resultsTimer);
  if (gameRoom.cleanupTimer) clearTimeout(gameRoom.cleanupTimer);
  gameRoom.roundTimer = null;
  gameRoom.resultsTimer = null;
  gameRoom.cleanupTimer = null;

  // Reset game state
  gameRoom.photos = [];
  gameRoom.currentPhotoIndex = 0;
  gameRoom.gameState = 'waiting';
  gameRoom.currentRound = 0;
  gameRoom.gameFinishedTime = null; // Clear finished timestamp

  gameRoom.players.forEach((player) => {
    player.photosUploaded = 0;
    player.score = 0;
    player.streak = 0;
  });

  gameRoom.scores.clear();
  gameRoom.players.forEach((player) => {
    gameRoom.scores.set(player.id, 0);
  });

  console.log(`Game reset in room ${roomCode} by host ${playerId}`);

  const fullGameState = {
    gameState: gameRoom.gameState,
    players: Array.from(gameRoom.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      photosUploaded: p.photosUploaded,
      isHost: p.isHost
    })),
    totalPhotos: gameRoom.photos.length,
    canStartGame: gameRoom.canStartGame(),
    hostId: gameRoom.hostId
  };

  io.to(roomCode.toUpperCase()).emit('gameReset', fullGameState);
  res.json({ message: 'Game reset successfully' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== HELPER FUNCTIONS =====

function showPhotoResults(gameRoom) {
  const currentPhoto = gameRoom.getCurrentPhoto();
  const correctPlayer = gameRoom.players.get(currentPhoto.playerId);

  gameRoom.awardTimeBonuses();

  io.to(gameRoom.roomCode).emit('photoResults', {
    correctPlayer: correctPlayer ? correctPlayer.name : 'Unknown',
    correctPlayerId: currentPhoto.playerId,
    guesses: Array.from(currentPhoto.guesses.entries()).map(([playerId, guessData]) => {
      const guesser = gameRoom.players.get(playerId);
      const guessed = gameRoom.players.get(guessData.guessedPlayerId);
      const correct = guessData.guessedPlayerId === currentPhoto.playerId;
      return {
        guesser: guesser ? guesser.name : 'Unknown',
        guessed: guessed ? guessed.name : 'Unknown',
        correct,
        timeToAnswer: guessData.timeToAnswer
      };
    }),
    leaderboard: gameRoom.getLeaderboard()
  });

  gameRoom.resultsTimer = setTimeout(() => {
    if (gameRoom.nextPhoto()) {
      showNextPhoto(gameRoom);
    } else {
      gameRoom.gameState = 'finished';
      gameRoom.gameFinishedTime = Date.now(); // Track when game finished for reset delay
      const finalLeaderboard = gameRoom.getLeaderboard();
      console.log(`Game finished in room ${gameRoom.roomCode}. Final results:`, finalLeaderboard);

      io.to(gameRoom.roomCode).emit('gameFinished', {
        leaderboard: finalLeaderboard
      });

      gameRoom.players.forEach((player) => {
        const socket = io.sockets.sockets.get(player.socketId);
        if (socket) {
          socket.emit('gameFinished', { leaderboard: finalLeaderboard });
        }
      });

      // Schedule cleanup after 10 minutes
      gameRoom.cleanupTimer = setTimeout(async () => {
        console.log(`Cleaning up room ${gameRoom.roomCode} after game finished`);
        await fileCleanupService.cleanupGamePhotos(gameRoom);
        gameRooms.delete(gameRoom.roomCode);
        console.log(`Total active rooms: ${gameRooms.size}`);
      }, 10 * 60 * 1000);
    }
  }, 5000);
}

function showNextPhoto(gameRoom) {
  const currentPhoto = gameRoom.getCurrentPhoto();
  if (!currentPhoto) {
    gameRoom.gameState = 'finished';
    io.to(gameRoom.roomCode).emit('gameFinished', {
      leaderboard: gameRoom.getLeaderboard()
    });
    return;
  }

  io.to(gameRoom.roomCode).emit('newPhoto', {
    photoUrl: currentPhoto.path,
    photoIndex: gameRoom.currentPhotoIndex + 1,
    totalPhotos: gameRoom.photos.length,
    players: Array.from(gameRoom.players.values()).map(p => ({
      id: p.id,
      name: p.name
    }))
  });

  gameRoom.roundTimer = setTimeout(() => {
    showPhotoResults(gameRoom);
  }, gameRoom.gameSettings.roundTime * 1000);
}

// ===== SOCKET.IO CONNECTION HANDLING =====

/**
 * WebSocket Authentication System
 *
 * Security: All WebSocket connections must be authenticated using JWT tokens
 *
 * Flow:
 * 1. Client joins room via POST /api/join-room
 * 2. Server generates JWT token with playerId, roomCode, playerName
 * 3. Client receives token and uses it to connect to WebSocket
 * 4. Server validates token and attaches verified info to socket
 * 5. All socket events validate that client data matches authenticated data
 *
 * This prevents:
 * - Impersonation attacks (can't fake playerId)
 * - Unauthorized room access
 * - Manipulation of game state by non-players
 */

// WebSocket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication token required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Attach verified player info to socket
    socket.playerId = decoded.playerId;
    socket.roomCode = decoded.roomCode;
    socket.playerName = decoded.playerName;
    next();
  } catch (err) {
    console.error('WebSocket authentication failed:', err.message);
    return next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (Player: ${socket.playerName}, Room: ${socket.roomCode})`);

  socket.on('joinRoom', ({ roomCode, playerId, playerName, isHost }) => {
    // Validate that client's playerId matches authenticated playerId
    if (playerId !== socket.playerId) {
      socket.emit('error', { message: 'PlayerId mismatch - authentication failed' });
      return;
    }

    // Validate that client's roomCode matches authenticated roomCode
    if (roomCode?.toUpperCase() !== socket.roomCode) {
      socket.emit('error', { message: 'RoomCode mismatch - authentication failed' });
      return;
    }

    const gameRoom = gameRooms.get(socket.roomCode);
    if (gameRoom) {
      const sanitizedName = sanitizePlayerName(socket.playerName); // Use authenticated playerName

      if (!sanitizedName || sanitizedName.length < 2) {
        socket.emit('error', { message: 'Invalid player name' });
        return;
      }

      const isReconnection = gameRoom.players.has(socket.playerId);
      gameRoom.addPlayer(socket.playerId, sanitizedName, socket.id, isHost || false);
      playerSockets.set(socket.id, { playerId: socket.playerId, roomCode: socket.roomCode });
      socket.join(socket.roomCode);

      if (!isReconnection) {
        socket.to(roomCode.toUpperCase()).emit('playerJoined', {
          playerName,
          totalPlayers: gameRoom.players.size
        });
      } else {
        console.log(`Player ${playerName} reconnected to room ${roomCode.toUpperCase()}`);
      }

      const fullGameState = {
        gameState: gameRoom.gameState,
        players: Array.from(gameRoom.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          photosUploaded: p.photosUploaded,
          isHost: p.isHost
        })),
        totalPhotos: gameRoom.photos.length,
        canStartGame: gameRoom.canStartGame(),
        hostId: gameRoom.hostId
      };

      socket.emit('gameState', fullGameState);

      if (isReconnection && gameRoom.gameState === 'playing') {
        const currentPhoto = gameRoom.getCurrentPhoto();
        if (currentPhoto) {
          socket.emit('newPhoto', {
            photoUrl: currentPhoto.path,
            photoIndex: gameRoom.currentPhotoIndex + 1,
            totalPhotos: gameRoom.photos.length,
            players: Array.from(gameRoom.players.values()).map(p => ({
              id: p.id,
              name: p.name
            }))
          });
        }
      }

      socket.to(roomCode.toUpperCase()).emit('gameState', fullGameState);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    const playerInfo = playerSockets.get(socket.id);
    if (playerInfo) {
      const gameRoom = gameRooms.get(playerInfo.roomCode);
      if (gameRoom) {
        const player = gameRoom.players.get(playerInfo.playerId);
        if (player) {
          const wasHost = player.isHost;

          if (gameRoom.gameState === 'waiting' || gameRoom.gameState === 'uploading') {
            console.log(`Player ${player.name} disconnected from room ${playerInfo.roomCode} (waiting phase)`);

            if (wasHost && gameRoom.players.size > 1) {
              for (const [pid, p] of gameRoom.players.entries()) {
                if (pid !== playerInfo.playerId && playerSockets.has(p.socketId)) {
                  gameRoom.hostId = pid;
                  p.isHost = true;
                  player.isHost = false;
                  console.log(`Host reassigned to ${p.name} (${pid})`);
                  break;
                }
              }
            }

            socket.to(playerInfo.roomCode).emit('playerLeft', {
              playerName: player.name,
              totalPlayers: gameRoom.players.size
            });
          } else {
            gameRoom.removePlayer(playerInfo.playerId);
            socket.to(playerInfo.roomCode).emit('playerLeft', {
              playerName: player.name,
              totalPlayers: gameRoom.players.size
            });
          }

          if (wasHost && gameRoom.players.size > 0) {
            const fullGameState = {
              gameState: gameRoom.gameState,
              players: Array.from(gameRoom.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                photosUploaded: p.photosUploaded,
                isHost: p.isHost
              })),
              totalPhotos: gameRoom.photos.length,
              canStartGame: gameRoom.canStartGame(),
              hostId: gameRoom.hostId
            };
            io.to(playerInfo.roomCode).emit('gameState', fullGameState);
          }

          if (gameRoom.players.size === 0) {
            console.log(`Room ${playerInfo.roomCode} is empty, cleaning up`);
            fileCleanupService.cleanupGamePhotos(gameRoom).catch(err => {
              console.error('Error cleaning up photos on room deletion:', err);
            });
            gameRooms.delete(playerInfo.roomCode);
          }
        }
      }
      playerSockets.delete(socket.id);
    }
  });
});

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Photo Blender server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Cloudinary configured: ${process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'demo' ? 'Yes' : 'No'}`);
});

// Schedule orphaned file cleanup every 6 hours
setInterval(() => {
  fileCleanupService.cleanupOrphanedFiles().catch(err => {
    console.error('Error in scheduled orphaned file cleanup:', err);
  });
}, 6 * 60 * 60 * 1000);

// Run initial cleanup after 5 minutes
setTimeout(() => {
  console.log('Running initial orphaned file cleanup...');
  fileCleanupService.cleanupOrphanedFiles().catch(err => {
    console.error('Error in initial orphaned file cleanup:', err);
  });
}, 5 * 60 * 1000);
