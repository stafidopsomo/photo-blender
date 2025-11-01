const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * GameRoom class manages the state and logic for a single game room
 * Handles players, photos, scoring, and game progression
 */
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
    this.cleanupTimer = null; // Timer to cleanup room after game ends
    this.gameFinishedTime = null; // Track when game finished for reset delay
    this.hostId = null; // Track the host player ID
    this.totalUploadSize = 0; // Track total upload size for the room in bytes
    this.gameSettings = {
      maxPlayers: 8,
      roundTime: 30, // seconds
      totalRounds: 10
    };
  }

  addPlayer(playerId, playerName, socketId, isHost = false) {
    // Check if player already exists (reconnection case)
    const existingPlayer = this.players.get(playerId);

    if (existingPlayer) {
      // Player is reconnecting - just update their socket ID
      existingPlayer.socketId = socketId;
      console.log(`Player ${playerName} (${playerId}) reconnected to room ${this.roomCode}`);
      return;
    }

    // Set host if this is the first player
    if (this.players.size === 0) {
      this.hostId = playerId;
      isHost = true;
    }

    // New player - create fresh entry
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      socketId: socketId,
      photosUploaded: 0,
      totalUploadSize: 0, // Track total upload size per player in bytes
      score: 0,
      streak: 0,
      isHost: playerId === this.hostId
    });
    this.scores.set(playerId, 0);
  }

  removePlayer(playerId) {
    const wasHost = this.hostId === playerId;
    this.players.delete(playerId);
    this.scores.delete(playerId);

    // If the removed player was the host, reassign
    if (wasHost && this.players.size > 0) {
      this.reassignHost();
    }
  }

  addPhoto(playerId, photoPath, fileSize = 0) {
    this.photos.push({
      id: uuidv4(),
      playerId: playerId,
      path: photoPath,
      fileSize: fileSize,
      guesses: new Map()
    });

    const player = this.players.get(playerId);
    if (player) {
      player.photosUploaded++;
      player.totalUploadSize += fileSize;
    }
    this.totalUploadSize += fileSize;
  }

  shufflePhotos() {
    // Use cryptographically secure random for photo shuffling
    for (let i = this.photos.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
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

        // Note: Time bonuses will be calculated AFTER all players submit
        // in the showPhotoResults function, so we can rank the top 3 fastest

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

  // Calculate and award time bonuses to top 3 fastest correct answers
  awardTimeBonuses() {
    const currentPhoto = this.getCurrentPhoto();
    if (!currentPhoto) return;

    // Get all correct guesses with their times
    const correctGuesses = Array.from(currentPhoto.guesses.entries())
      .filter(([playerId, guess]) => guess.guessedPlayerId === currentPhoto.playerId)
      .map(([playerId, guess]) => ({
        playerId,
        timeToAnswer: guess.timeToAnswer
      }))
      .sort((a, b) => a.timeToAnswer - b.timeToAnswer); // Sort by speed (fastest first)

    // Award bonuses to top 3 fastest based on their actual time
    for (let i = 0; i < Math.min(3, correctGuesses.length); i++) {
      const { playerId, timeToAnswer } = correctGuesses[i];
      const player = this.players.get(playerId);
      if (player) {
        // Time bonus based on speed (faster = more points)
        // Max bonus: 100 points for instant answer (0s)
        // Min bonus: 0 points for 30s answer
        const maxTime = 30; // seconds
        const bonus = Math.round(Math.max(0, (maxTime - timeToAnswer) / maxTime * 100));

        const currentScore = this.scores.get(playerId) || 0;
        this.scores.set(playerId, currentScore + bonus);
        player.score = currentScore + bonus;
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

  reassignHost() {
    // Find the first available player to become host
    const firstPlayer = Array.from(this.players.values())[0];
    if (firstPlayer) {
      this.hostId = firstPlayer.id;
      firstPlayer.isHost = true;
      console.log(`New host assigned: ${firstPlayer.name} (${firstPlayer.id})`);
      return firstPlayer.id;
    }
    return null;
  }
}

module.exports = GameRoom;
