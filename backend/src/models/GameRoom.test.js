const GameRoom = require('./GameRoom');

describe('GameRoom', () => {
  let gameRoom;

  beforeEach(() => {
    gameRoom = new GameRoom('TEST123');
  });

  describe('constructor', () => {
    test('should initialize with correct room code', () => {
      expect(gameRoom.roomCode).toBe('TEST123');
    });

    test('should initialize with empty players map', () => {
      expect(gameRoom.players.size).toBe(0);
    });

    test('should initialize with empty photos array', () => {
      expect(gameRoom.photos).toEqual([]);
    });

    test('should initialize with waiting game state', () => {
      expect(gameRoom.gameState).toBe('waiting');
    });

    test('should initialize with default game settings', () => {
      expect(gameRoom.gameSettings).toEqual({
        maxPlayers: 8,
        roundTime: 30,
        totalRounds: 10
      });
    });

    test('should initialize with null host ID', () => {
      expect(gameRoom.hostId).toBeNull();
    });
  });

  describe('addPlayer', () => {
    test('should add a new player', () => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      expect(gameRoom.players.size).toBe(1);
      expect(gameRoom.players.get('player1')).toMatchObject({
        id: 'player1',
        name: 'Alice',
        socketId: 'socket1',
        score: 0,
        streak: 0
      });
    });

    test('should set first player as host', () => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      expect(gameRoom.hostId).toBe('player1');
      expect(gameRoom.players.get('player1').isHost).toBe(true);
    });

    test('should not set second player as host', () => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      gameRoom.addPlayer('player2', 'Bob', 'socket2');
      expect(gameRoom.players.get('player2').isHost).toBe(false);
    });

    test('should update socket ID on reconnection', () => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      gameRoom.addPlayer('player1', 'Alice', 'socket2');
      expect(gameRoom.players.size).toBe(1);
      expect(gameRoom.players.get('player1').socketId).toBe('socket2');
    });
  });

  describe('removePlayer', () => {
    beforeEach(() => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      gameRoom.addPlayer('player2', 'Bob', 'socket2');
    });

    test('should remove a player', () => {
      gameRoom.removePlayer('player2');
      expect(gameRoom.players.size).toBe(1);
      expect(gameRoom.players.has('player2')).toBe(false);
    });

    test('should remove player score', () => {
      gameRoom.removePlayer('player2');
      expect(gameRoom.scores.has('player2')).toBe(false);
    });

    test('should reassign host if host leaves', () => {
      gameRoom.removePlayer('player1');
      expect(gameRoom.hostId).toBe('player2');
      expect(gameRoom.players.get('player2').isHost).toBe(true);
    });
  });

  describe('addPhoto', () => {
    beforeEach(() => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
    });

    test('should add a photo to the room', () => {
      gameRoom.addPhoto('player1', '/uploads/photo.jpg');
      expect(gameRoom.photos.length).toBe(1);
    });

    test('should include player ID in photo', () => {
      gameRoom.addPhoto('player1', '/uploads/photo.jpg');
      expect(gameRoom.photos[0].playerId).toBe('player1');
    });

    test('should include photo path', () => {
      gameRoom.addPhoto('player1', '/uploads/photo.jpg');
      expect(gameRoom.photos[0].path).toBe('/uploads/photo.jpg');
    });

    test('should increment player photo count', () => {
      gameRoom.addPhoto('player1', '/uploads/photo1.jpg');
      gameRoom.addPhoto('player1', '/uploads/photo2.jpg');
      expect(gameRoom.players.get('player1').photosUploaded).toBe(2);
    });

    test('should create empty guesses map for photo', () => {
      gameRoom.addPhoto('player1', '/uploads/photo.jpg');
      expect(gameRoom.photos[0].guesses).toBeInstanceOf(Map);
      expect(gameRoom.photos[0].guesses.size).toBe(0);
    });
  });

  describe('shufflePhotos', () => {
    beforeEach(() => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      for (let i = 0; i < 10; i++) {
        gameRoom.addPhoto('player1', `/uploads/photo${i}.jpg`);
      }
    });

    test('should not change photo count', () => {
      const originalLength = gameRoom.photos.length;
      gameRoom.shufflePhotos();
      expect(gameRoom.photos.length).toBe(originalLength);
    });

    test('should shuffle photos (probabilistic test)', () => {
      const originalOrder = gameRoom.photos.map(p => p.path);
      gameRoom.shufflePhotos();
      const shuffledOrder = gameRoom.photos.map(p => p.path);

      // With 10 photos, probability of same order is 1/10! (very low)
      // So this test should almost always pass
      expect(shuffledOrder).not.toEqual(originalOrder);
    });
  });

  describe('submitGuess', () => {
    beforeEach(() => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      gameRoom.addPlayer('player2', 'Bob', 'socket2');
      gameRoom.addPhoto('player1', '/uploads/photo.jpg');
    });

    test('should record correct guess', () => {
      gameRoom.submitGuess('player2', 'player1', 10);
      const currentPhoto = gameRoom.getCurrentPhoto();
      expect(currentPhoto.guesses.has('player2')).toBe(true);
    });

    test('should award points for correct guess', () => {
      gameRoom.submitGuess('player2', 'player1', 10);
      const player = gameRoom.players.get('player2');
      expect(player.score).toBeGreaterThan(0);
    });

    test('should not award points for incorrect guess', () => {
      gameRoom.submitGuess('player2', 'player2', 10);
      const player = gameRoom.players.get('player2');
      expect(player.score).toBe(0);
    });

    test('should increment streak on correct guess', () => {
      gameRoom.submitGuess('player2', 'player1', 10);
      const player = gameRoom.players.get('player2');
      expect(player.streak).toBe(1);
    });

    test('should reset streak on incorrect guess', () => {
      gameRoom.players.get('player2').streak = 5;
      gameRoom.submitGuess('player2', 'player2', 10);
      const player = gameRoom.players.get('player2');
      expect(player.streak).toBe(0);
    });

    test('should award streak bonus after 3 correct guesses', () => {
      gameRoom.addPhoto('player1', '/uploads/photo2.jpg');
      gameRoom.addPhoto('player1', '/uploads/photo3.jpg');

      // First guess - no bonus
      gameRoom.currentPhotoIndex = 0;
      gameRoom.submitGuess('player2', 'player1', 10);
      const score1 = gameRoom.players.get('player2').score;

      // Second guess - no bonus
      gameRoom.currentPhotoIndex = 1;
      gameRoom.submitGuess('player2', 'player1', 10);
      const score2 = gameRoom.players.get('player2').score;

      // Third guess - should get streak bonus
      gameRoom.currentPhotoIndex = 2;
      gameRoom.submitGuess('player2', 'player1', 10);
      const score3 = gameRoom.players.get('player2').score;

      // Third score should be higher due to streak bonus
      expect(score3 - score2).toBeGreaterThan(score2 - score1);
    });
  });

  describe('getLeaderboard', () => {
    beforeEach(() => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      gameRoom.addPlayer('player2', 'Bob', 'socket2');
      gameRoom.addPlayer('player3', 'Charlie', 'socket3');
    });

    test('should return sorted leaderboard', () => {
      gameRoom.players.get('player1').score = 100;
      gameRoom.players.get('player2').score = 200;
      gameRoom.players.get('player3').score = 150;

      const leaderboard = gameRoom.getLeaderboard();
      expect(leaderboard[0].name).toBe('Bob');
      expect(leaderboard[1].name).toBe('Charlie');
      expect(leaderboard[2].name).toBe('Alice');
    });

    test('should include score and streak', () => {
      gameRoom.players.get('player1').score = 100;
      gameRoom.players.get('player1').streak = 3;

      const leaderboard = gameRoom.getLeaderboard();
      const player = leaderboard.find(p => p.name === 'Alice');
      expect(player.score).toBe(100);
      expect(player.streak).toBe(3);
    });
  });

  describe('canStartGame', () => {
    test('should return false with less than 2 players', () => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      for (let i = 0; i < 10; i++) {
        gameRoom.addPhoto('player1', `/uploads/photo${i}.jpg`);
      }
      expect(gameRoom.canStartGame()).toBe(false);
    });

    test('should return false with less than 10 photos', () => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      gameRoom.addPlayer('player2', 'Bob', 'socket2');
      gameRoom.addPhoto('player1', '/uploads/photo1.jpg');
      expect(gameRoom.canStartGame()).toBe(false);
    });

    test('should return true with 2+ players and 10+ photos', () => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      gameRoom.addPlayer('player2', 'Bob', 'socket2');
      // Both players need to have uploaded photos
      for (let i = 0; i < 5; i++) {
        gameRoom.addPhoto('player1', `/uploads/photo${i}.jpg`);
      }
      for (let i = 5; i < 10; i++) {
        gameRoom.addPhoto('player2', `/uploads/photo${i}.jpg`);
      }
      expect(gameRoom.canStartGame()).toBe(true);
    });

    test('should return false if players have no photos', () => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      gameRoom.addPlayer('player2', 'Bob', 'socket2');
      expect(gameRoom.canStartGame()).toBe(false);
    });
  });

  describe('reassignHost', () => {
    test('should assign host to first available player', () => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      gameRoom.addPlayer('player2', 'Bob', 'socket2');
      gameRoom.hostId = null;

      gameRoom.reassignHost();
      expect(gameRoom.hostId).toBe('player1');
      expect(gameRoom.players.get('player1').isHost).toBe(true);
    });

    test('should return null if no players available', () => {
      const result = gameRoom.reassignHost();
      expect(result).toBeNull();
    });
  });

  describe('getCurrentPhoto', () => {
    beforeEach(() => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      gameRoom.addPhoto('player1', '/uploads/photo1.jpg');
      gameRoom.addPhoto('player1', '/uploads/photo2.jpg');
    });

    test('should return current photo', () => {
      const photo = gameRoom.getCurrentPhoto();
      expect(photo.path).toBe('/uploads/photo1.jpg');
    });

    test('should return correct photo after index change', () => {
      gameRoom.currentPhotoIndex = 1;
      const photo = gameRoom.getCurrentPhoto();
      expect(photo.path).toBe('/uploads/photo2.jpg');
    });
  });

  describe('nextPhoto', () => {
    beforeEach(() => {
      gameRoom.addPlayer('player1', 'Alice', 'socket1');
      gameRoom.addPhoto('player1', '/uploads/photo1.jpg');
      gameRoom.addPhoto('player1', '/uploads/photo2.jpg');
    });

    test('should increment photo index', () => {
      gameRoom.nextPhoto();
      expect(gameRoom.currentPhotoIndex).toBe(1);
    });

    test('should return true if more photos available', () => {
      const result = gameRoom.nextPhoto();
      expect(result).toBe(true);
    });

    test('should return false if no more photos', () => {
      gameRoom.currentPhotoIndex = 1;
      const result = gameRoom.nextPhoto();
      expect(result).toBe(false);
    });
  });
});
