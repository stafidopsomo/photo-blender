const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || 'demo',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'demo'
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

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
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Game state management
const gameRooms = new Map();
const playerSockets = new Map();

class GameRoom {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.players = new Map();
    this.photos = [];
    this.currentPhotoIndex = 0;
    this.gameState = 'waiting'; // waiting, uploading, playing, finished
    this.currentRound = 0;
    this.scores = new Map();
    this.roundTimer = null;
    this.resultsTimer = null;
    this.gameSettings = {
      maxPlayers: 8,
      roundTime: 30, // seconds
      totalRounds: 10
    };
  }

  addPlayer(playerId, playerName, socketId, isHost = false) {
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      socketId: socketId,
      photosUploaded: 0,
      score: 0,
      streak: 0,
      isHost: isHost
    });
    this.scores.set(playerId, 0);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.scores.delete(playerId);
  }

  addPhoto(playerId, photoPath) {
    this.photos.push({
      id: uuidv4(),
      playerId: playerId,
      path: photoPath,
      guesses: new Map()
    });
    
    const player = this.players.get(playerId);
    if (player) {
      player.photosUploaded++;
    }
  }

  shufflePhotos() {
    for (let i = this.photos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.photos[i], this.photos[j]] = [this.photos[j], this.photos[i]];
    }
  }

  getCurrentPhoto() {
    return this.photos[this.currentPhotoIndex];
  }

  nextPhoto() {
    this.currentPhotoIndex++;
    return this.currentPhotoIndex < this.photos.length;
  }

  submitGuess(playerId, guessedPlayerId, timeToAnswer) {
    const currentPhoto = this.getCurrentPhoto();
    if (currentPhoto) {
      currentPhoto.guesses.set(playerId, {
        guessedPlayerId,
        timeToAnswer,
        timestamp: Date.now()
      });

      const player = this.players.get(playerId);
      if (!player) return;

      // Award points if correct
      if (guessedPlayerId === currentPhoto.playerId) {
        // Base points: 100
        let points = 100;

        // Time bonus: up to 100 points (faster = more points)
        // 0-5s: +100, 5-15s: +50, 15-25s: +25, 25-30s: +10
        if (timeToAnswer <= 5) {
          points += 100;
        } else if (timeToAnswer <= 15) {
          points += 50;
        } else if (timeToAnswer <= 25) {
          points += 25;
        } else {
          points += 10;
        }

        // Streak bonus
        player.streak = (player.streak || 0) + 1;
        if (player.streak >= 3) {
          points += player.streak * 10; // +10 per streak level after 3
        }

        const currentScore = this.scores.get(playerId) || 0;
        this.scores.set(playerId, currentScore + points);
        player.score = currentScore + points;
      } else {
        // Wrong answer - reset streak
        player.streak = 0;
      }
    }
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map(player => ({
        name: player.name,
        score: player.score || 0,
        streak: player.streak || 0
      }));
  }

  canStartGame() {
    const playersWithPhotos = Array.from(this.players.values())
      .filter(player => player.photosUploaded > 0);
    return playersWithPhotos.length >= 2 && this.photos.length >= 10;
  }
}

// Utility functions
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getPlayerFromSocket(socketId) {
  return playerSockets.get(socketId);
}

// API Routes

// Create a new game room
app.post('/api/create-room', (req, res) => {
  const roomCode = generateRoomCode();
  const gameRoom = new GameRoom(roomCode);
  gameRooms.set(roomCode, gameRoom);
  
  res.json({ roomCode });
});

// Join a game room
app.post('/api/join-room', (req, res) => {
  const { roomCode, playerName } = req.body;

  if (!roomCode || !playerName) {
    return res.status(400).json({ error: 'Room code and player name are required' });
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
  const isHost = gameRoom.players.size === 0; // First player is host

  res.json({
    playerId,
    roomCode: gameRoom.roomCode,
    gameState: gameRoom.gameState,
    isHost
  });
});

// Upload photo
app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
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

    // Compress and resize image
    const compressedPath = path.join(uploadsDir, 'compressed-' + req.file.filename);
    await sharp(req.file.path)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(compressedPath);

    // Remove original file
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

        // Remove local file after upload to cloudinary
        fs.unlinkSync(compressedPath);
      } catch (cloudError) {
        console.error('Cloudinary upload failed, using local storage:', cloudError);
        // Fall back to local storage if cloudinary fails
      }
    }

    // Add photo to game room with URL
    gameRoom.addPhoto(playerId, photoUrl);

    // Notify room about photo upload
    io.to(roomCode.toUpperCase()).emit('photoUploaded', {
      playerName: player.name,
      totalPhotos: gameRoom.photos.length,
      canStartGame: gameRoom.canStartGame()
    });

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
app.post('/api/start-game', (req, res) => {
  const { roomCode, playerId } = req.body;
  
  const gameRoom = gameRooms.get(roomCode?.toUpperCase());
  if (!gameRoom) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  if (!gameRoom.canStartGame()) {
    return res.status(400).json({ error: 'Cannot start game yet. Need at least 2 players and 10 total photos.' });
  }
  
  gameRoom.gameState = 'playing';
  gameRoom.shufflePhotos();
  gameRoom.currentPhotoIndex = 0;
  
  // Start the game for all players
  io.to(roomCode.toUpperCase()).emit('gameStarted', {
    totalPhotos: gameRoom.photos.length,
    players: Array.from(gameRoom.players.values()).map(p => ({
      id: p.id,
      name: p.name
    }))
  });
  
  // Send first photo
  setTimeout(() => {
    showNextPhoto(gameRoom);
  }, 2000);
  
  res.json({ message: 'Game started!' });
});

// Submit guess
app.post('/api/submit-guess', (req, res) => {
  const { roomCode, playerId, guessedPlayerId, timeToAnswer } = req.body;

  const gameRoom = gameRooms.get(roomCode?.toUpperCase());
  if (!gameRoom) {
    return res.status(404).json({ error: 'Room not found' });
  }

  gameRoom.submitGuess(playerId, guessedPlayerId, timeToAnswer || 30);

  // Check if all players have submitted
  const currentPhoto = gameRoom.getCurrentPhoto();
  const totalPlayers = gameRoom.players.size;
  const submittedGuesses = currentPhoto.guesses.size;

  if (submittedGuesses === totalPlayers) {
    // All players submitted, show results immediately
    if (gameRoom.roundTimer) {
      clearTimeout(gameRoom.roundTimer);
      gameRoom.roundTimer = null;
    }
    showPhotoResults(gameRoom);
  }

  res.json({ message: 'Guess submitted' });
});

// Helper function to show photo results
function showPhotoResults(gameRoom) {
  const currentPhoto = gameRoom.getCurrentPhoto();
  const correctPlayer = gameRoom.players.get(currentPhoto.playerId);

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

  // Move to next photo after showing results
  gameRoom.resultsTimer = setTimeout(() => {
    if (gameRoom.nextPhoto()) {
      showNextPhoto(gameRoom);
    } else {
      gameRoom.gameState = 'finished';
      io.to(gameRoom.roomCode).emit('gameFinished', {
        leaderboard: gameRoom.getLeaderboard()
      });
    }
  }, 5000); // Show results for 5 seconds
}

// Helper function to show next photo
function showNextPhoto(gameRoom) {
  const currentPhoto = gameRoom.getCurrentPhoto();
  if (!currentPhoto) {
    // Game finished
    gameRoom.gameState = 'finished';
    io.to(gameRoom.roomCode).emit('gameFinished', {
      leaderboard: gameRoom.getLeaderboard()
    });
    return;
  }

  // Send photo to all players
  io.to(gameRoom.roomCode).emit('newPhoto', {
    photoUrl: currentPhoto.path, // Now stores full URL (either local or Cloudinary)
    photoIndex: gameRoom.currentPhotoIndex + 1,
    totalPhotos: gameRoom.photos.length,
    players: Array.from(gameRoom.players.values()).map(p => ({
      id: p.id,
      name: p.name
    }))
  });

  // Set timer for round - will be cleared if all players submit early
  gameRoom.roundTimer = setTimeout(() => {
    showPhotoResults(gameRoom);
  }, gameRoom.gameSettings.roundTime * 1000);
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('joinRoom', ({ roomCode, playerId, playerName, isHost }) => {
    const gameRoom = gameRooms.get(roomCode?.toUpperCase());
    if (gameRoom) {
      gameRoom.addPlayer(playerId, playerName, socket.id, isHost || false);
      playerSockets.set(socket.id, { playerId, roomCode: roomCode.toUpperCase() });
      
      socket.join(roomCode.toUpperCase());
      
      // Notify room about new player
      socket.to(roomCode.toUpperCase()).emit('playerJoined', {
        playerName,
        totalPlayers: gameRoom.players.size
      });
      
      // Send current game state to new player
      socket.emit('gameState', {
        gameState: gameRoom.gameState,
        players: Array.from(gameRoom.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          photosUploaded: p.photosUploaded
        })),
        totalPhotos: gameRoom.photos.length,
        canStartGame: gameRoom.canStartGame()
      });
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
          gameRoom.removePlayer(playerInfo.playerId);
          
          // Notify room about player leaving
          socket.to(playerInfo.roomCode).emit('playerLeft', {
            playerName: player.name,
            totalPlayers: gameRoom.players.size
          });
          
          // Clean up empty rooms
          if (gameRoom.players.size === 0) {
            gameRooms.delete(playerInfo.roomCode);
          }
        }
      }
      playerSockets.delete(socket.id);
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`Photo Roulette server running on port ${PORT}`);
});
