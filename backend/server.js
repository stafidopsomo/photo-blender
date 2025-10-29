const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
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

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Trust proxy - Required for Render.com and other reverse proxies
// This allows rate limiters to correctly identify users by IP
app.set('trust proxy', 1);

// Middleware
app.use(cors());
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
  let attempts = 0;
  const MAX_ATTEMPTS = 10;

  do {
    roomCode = generateRoomCode();
    attempts++;
    if (attempts >= MAX_ATTEMPTS) {
      return res.status(500).json({ error: 'Failed to generate unique room code. Please try again.' });
    }
  } while (gameRooms.has(roomCode));

  // Immediately reserve this code
  const gameRoom = new GameRoom(roomCode);
  gameRooms.set(roomCode, gameRoom);

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

  res.json({
    playerId,
    roomCode: gameRoom.roomCode,
    gameState: gameRoom.gameState,
    isHost,
    sanitizedName
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

    const MAX_PHOTOS_PER_PLAYER = 20;
    if (player.photosUploaded >= MAX_PHOTOS_PER_PLAYER) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `Maximum ${MAX_PHOTOS_PER_PLAYER} photos per player` });
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

    gameRoom.addPhoto(playerId, photoUrl);

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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', ({ roomCode, playerId, playerName, isHost }) => {
    const gameRoom = gameRooms.get(roomCode?.toUpperCase());
    if (gameRoom) {
      const sanitizedName = sanitizePlayerName(playerName);

      if (!sanitizedName || sanitizedName.length < 2) {
        socket.emit('error', { message: 'Invalid player name' });
        return;
      }

      const isReconnection = gameRoom.players.has(playerId);
      gameRoom.addPlayer(playerId, sanitizedName, socket.id, isHost || false);
      playerSockets.set(socket.id, { playerId, roomCode: roomCode.toUpperCase() });
      socket.join(roomCode.toUpperCase());

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
