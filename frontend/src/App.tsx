import React, { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
import './index.css';

// Types
interface Player {
  id: string;
  name: string;
  photosUploaded?: number;
  score?: number;
  isHost?: boolean;
}

interface GameState {
  gameState: 'waiting' | 'uploading' | 'playing' | 'finished';
  players: Player[];
  totalPhotos: number;
  canStartGame: boolean;
}

interface PhotoData {
  photoUrl: string;
  photoIndex: number;
  totalPhotos: number;
  players: Player[];
}

interface PhotoResults {
  correctPlayer: string;
  correctPlayerId: string;
  guesses: Array<{
    guesser: string;
    guessed: string;
    correct: boolean;
    timeToAnswer?: number;
  }>;
  leaderboard: Array<{
    name: string;
    score: number;
    streak?: number;
  }>;
}

const API_BASE = process.env.NODE_ENV === 'production' ? process.env.REACT_APP_API_URL || window.location.origin : 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'join' | 'create' | 'waiting' | 'uploading' | 'game' | 'results'>('home');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [gameState, setGameState] = useState<GameState>({
    gameState: 'waiting',
    players: [],
    totalPhotos: 0,
    canStartGame: false
  });
  const [currentPhoto, setCurrentPhoto] = useState<PhotoData | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [photoResults, setPhotoResults] = useState<PhotoResults | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [hasSubmittedGuess, setHasSubmittedGuess] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [photoStartTime, setPhotoStartTime] = useState<number>(0);
  const [uploadMode, setUploadMode] = useState<'manual' | 'auto'>('manual');
  const [showPlayersList, setShowPlayersList] = useState(false);

  // Check for saved session on mount (reconnection)
  useEffect(() => {
    const savedSession = localStorage.getItem('photoRouletteSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        // Auto-fill the form with saved data
        setPlayerName(session.playerName || '');
        setRoomCode(session.roomCode || '');
        setPlayerId(session.playerId || '');
        setIsHost(session.isHost || false);

        // Show a reconnect prompt
        if (session.roomCode && session.playerId && session.playerName) {
          setSuccess(`Found previous session in room ${session.roomCode}. Rejoin?`);
        }
      } catch (e) {
        // Invalid session data, clear it
        localStorage.removeItem('photoRouletteSession');
      }
    }
  }, []);

  useEffect(() => {
    if (roomCode && playerId && playerName) {
      const newSocket = io(API_BASE);
      setSocket(newSocket);

      newSocket.emit('joinRoom', { roomCode, playerId, playerName, isHost });

      newSocket.on('gameState', (state: GameState) => {
        setGameState(state);
        if (state.gameState === 'waiting') {
          setCurrentView('waiting');
        }
      });

      newSocket.on('playerJoined', (data: { playerName: string; totalPlayers: number }) => {
        setSuccess(`${data.playerName} joined the game!`);
        setTimeout(() => setSuccess(''), 3000);
      });

      newSocket.on('playerLeft', (data: { playerName: string; totalPlayers: number }) => {
        setSuccess(`${data.playerName} left the game`);
        setTimeout(() => setSuccess(''), 3000);
      });

      newSocket.on('photoUploaded', (data: { playerName: string; totalPhotos: number; canStartGame: boolean }) => {
        setGameState(prev => ({
          ...prev,
          totalPhotos: data.totalPhotos,
          canStartGame: data.canStartGame
        }));
        setSuccess(`${data.playerName} uploaded a photo!`);
        setTimeout(() => setSuccess(''), 3000);
      });

      newSocket.on('gameStarted', (data: { totalPhotos: number; players: Player[] }) => {
        setCurrentView('game');
        setGameState(prev => ({ ...prev, gameState: 'playing' }));
        setSuccess('Game started! Get ready...');
        setTimeout(() => setSuccess(''), 3000);
      });

      newSocket.on('newPhoto', (data: PhotoData) => {
        setCurrentPhoto(data);
        setSelectedPlayer('');
        setPhotoResults(null);
        setCurrentView('game');
        setTimeRemaining(30);
        setHasSubmittedGuess(false);
        setPhotoStartTime(Date.now());
      });

      newSocket.on('photoResults', (data: PhotoResults) => {
        setPhotoResults(data);
        setTimeout(() => {
          setPhotoResults(null);
        }, 5000);
      });

      newSocket.on('gameFinished', (data: { leaderboard: Array<{ name: string; score: number }> }) => {
        console.log('Game finished event received', data);
        setCurrentView('results');
        setPhotoResults({
          correctPlayer: '',
          correctPlayerId: '',
          guesses: [],
          leaderboard: data.leaderboard
        });
        setGameState(prev => ({ ...prev, gameState: 'finished' }));
      });

      newSocket.on('gameReset', (state: GameState & { hostId?: string }) => {
        console.log('Game reset event received', state);
        setCurrentView('waiting');
        setGameState(state);
        setCurrentPhoto(null);
        setSelectedPlayer('');
        setPhotoResults(null);
        setUploadedPhotos([]);

        // Update isHost state based on the hostId from server
        if (state.hostId) {
          setIsHost(playerId === state.hostId);
          console.log('Updated isHost:', playerId === state.hostId, 'playerId:', playerId, 'hostId:', state.hostId);
        }

        setSuccess('Game reset! Upload new photos to play again.');
        setTimeout(() => setSuccess(''), 3000);
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [roomCode, playerId, playerName]);

  // Timer countdown effect
  useEffect(() => {
    if (currentPhoto && !photoResults && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => prev > 0 ? prev - 1 : 0);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentPhoto, photoResults, timeRemaining]);

  const createRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE}/api/create-room`);
      const newRoomCode = response.data.roomCode;

      const joinResponse = await axios.post(`${API_BASE}/api/join-room`, {
        roomCode: newRoomCode,
        playerName: playerName.trim()
      });

      setRoomCode(newRoomCode);
      setPlayerId(joinResponse.data.playerId);
      setIsHost(joinResponse.data.isHost || true);
      setCurrentView('waiting');

      // Save session to localStorage for reconnection
      localStorage.setItem('photoRouletteSession', JSON.stringify({
        roomCode: newRoomCode,
        playerId: joinResponse.data.playerId,
        playerName: playerName.trim(),
        isHost: true
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      setError('Please enter your name and room code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE}/api/join-room`, {
        roomCode: roomCode.trim(),
        playerName: playerName.trim()
      });

      setPlayerId(response.data.playerId);
      setRoomCode(response.data.roomCode);
      setIsHost(response.data.isHost || false);
      setCurrentView('waiting');

      // Save session to localStorage for reconnection
      localStorage.setItem('photoRouletteSession', JSON.stringify({
        roomCode: response.data.roomCode,
        playerId: response.data.playerId,
        playerName: playerName.trim(),
        isHost: response.data.isHost || false
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const uploadPhoto = async (file: File, skipLoadingState = false, photoIndex = 0, totalPhotos = 1) => {
    if (!file) return;

    if (!skipLoadingState) {
      setLoading(true);
    }
    setError('');

    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('roomCode', roomCode);
      formData.append('playerId', playerId);

      await axios.post(`${API_BASE}/api/upload-photo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (totalPhotos > 1) {
            // Calculate total progress across all photos
            const currentPhotoProgress = progressEvent.total
              ? (progressEvent.loaded / progressEvent.total)
              : 0;
            const completedPhotos = photoIndex;
            const totalProgress = ((completedPhotos + currentPhotoProgress) / totalPhotos) * 100;
            setUploadProgress(Math.round(totalProgress));
          } else {
            // Single photo upload
            const percentCompleted = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadProgress(percentCompleted);
          }
        }
      });

      setUploadedPhotos(prev => [...prev, URL.createObjectURL(file)]);

      if (!skipLoadingState) {
        setSuccess('Photo uploaded successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload photo');
      throw err; // Re-throw to handle in caller
    } finally {
      if (!skipLoadingState) {
        setLoading(false);
      }
    }
  };

  const startGame = async () => {
    setLoading(true);
    setError('');

    try {
      await axios.post(`${API_BASE}/api/start-game`, {
        roomCode,
        playerId
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const submitGuess = async (guessedPlayerId?: string) => {
    const playerToGuess = guessedPlayerId || selectedPlayer;

    if (!playerToGuess) {
      setError('Please select a player');
      return;
    }

    if (hasSubmittedGuess) {
      return; // Already submitted
    }

    try {
      const timeToAnswer = 30 - timeRemaining;

      await axios.post(`${API_BASE}/api/submit-guess`, {
        roomCode,
        playerId,
        guessedPlayerId: playerToGuess,
        timeToAnswer
      });

      setSelectedPlayer(playerToGuess);
      setHasSubmittedGuess(true);
      setSuccess('Guess submitted! Waiting for other players...');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit guess');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadPhoto(file);
    }
  };

  const handleMultipleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    let filesToUpload: File[] = [];

    if (uploadMode === 'auto') {
      // RANDOM AUTO-PICK MODE: Shuffle and upload all selected photos
      const filesArray = Array.from(files);
      const shuffled = filesArray.sort(() => 0.5 - Math.random());
      filesToUpload = shuffled;
      setSuccess(`🎲 Randomly shuffled ${filesToUpload.length} photos!`);
      setTimeout(() => setSuccess(''), 2000);
    } else {
      // MANUAL MODE: Upload all selected files
      filesToUpload = Array.from(files);
    }

    setLoading(true);
    setError('');
    setUploadProgress(0);

    let successCount = 0;
    const totalFiles = filesToUpload.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = filesToUpload[i];
      try {
        // Pass photoIndex and totalPhotos for accurate progress tracking
        await uploadPhoto(file, true, i, totalFiles);
        successCount++;
      } catch (err) {
        console.error('Failed to upload file:', file.name, err);
      }
    }

    setLoading(false);
    setUploadProgress(0);

    if (successCount > 0) {
      setSuccess(`${successCount} photo${successCount > 1 ? 's' : ''} uploaded successfully! 🎉`);
      setTimeout(() => setSuccess(''), 3000);
    }

    // Reset the file input
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      uploadPhoto(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const resetGame = () => {
    // Clear session from localStorage
    localStorage.removeItem('photoRouletteSession');

    setCurrentView('home');
    setRoomCode('');
    setPlayerId('');
    setPlayerName('');
    setGameState({
      gameState: 'waiting',
      players: [],
      totalPhotos: 0,
      canStartGame: false
    });
    setCurrentPhoto(null);
    setSelectedPlayer('');
    setPhotoResults(null);
    setUploadedPhotos([]);
    setError('');
    setSuccess('');
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  const playAgain = async () => {
    // Reset to waiting room but keep players in the same room
    try {
      await axios.post(`${API_BASE}/api/reset-game`, {
        roomCode,
        playerId
      });

      // Reset local state
      setCurrentView('waiting');
      setCurrentPhoto(null);
      setSelectedPlayer('');
      setPhotoResults(null);
      setUploadedPhotos([]);
      setGameState(prev => ({
        ...prev,
        gameState: 'waiting'
      }));
      setSuccess('Game reset! Upload photos to start a new game.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset game');
    }
  };

  // Rejoin with saved session
  const rejoinSession = () => {
    const savedSession = localStorage.getItem('photoRouletteSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setPlayerName(session.playerName);
        setRoomCode(session.roomCode);
        setPlayerId(session.playerId);
        setIsHost(session.isHost);
        setCurrentView('waiting');
        setSuccess('Reconnecting to room...');
      } catch (e) {
        setError('Failed to reconnect');
        localStorage.removeItem('photoRouletteSession');
      }
    }
  };

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1 className="title">📸 Photo Roulette</h1>
          <p className="subtitle">Guess whose photo it is!</p>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {currentView === 'home' && (
          <div>
            {/* Show rejoin button if session exists */}
            {localStorage.getItem('photoRouletteSession') && (
              <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <button
                  className="button button-primary"
                  onClick={rejoinSession}
                  style={{ marginBottom: '10px' }}
                >
                  🔄 Rejoin Previous Game
                </button>
                <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                  or start a new game below
                </p>
              </div>
            )}

            <div className="form">
              <div className="input-group">
                <label className="label">Your Name</label>
                <input
                  type="text"
                  className="input"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={20}
                />
              </div>
            </div>

            <div className="form">
              <button
                className="button button-primary"
                onClick={createRoom}
                disabled={loading || !playerName.trim()}
              >
                {loading ? 'Creating...' : 'Create New Game'}
              </button>

              <button
                className="button button-secondary"
                onClick={() => setCurrentView('join')}
                disabled={!playerName.trim()}
              >
                Join Existing Game
              </button>
            </div>
          </div>
        )}

        {currentView === 'join' && (
          <div>
            <div className="form">
              <div className="input-group">
                <label className="label">Room Code</label>
                <input
                  type="text"
                  className="input"
                  value={roomCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setRoomCode(value);
                  }}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
            </div>
            
            <div className="form">
              <button 
                className="button button-primary"
                onClick={joinRoom}
                disabled={loading || !roomCode.trim()}
              >
                {loading ? 'Joining...' : 'Join Game'}
              </button>
              
              <button 
                className="button button-secondary"
                onClick={() => setCurrentView('home')}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {currentView === 'waiting' && (
          <div className="waiting-room">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Room: {roomCode}</h2>
            <p style={{ fontSize: '0.9rem', marginBottom: '16px', opacity: 0.9 }}>Share this code with your friends!</p>

            {/* Collapsible Players List */}
            <div className="players-list-collapsible">
              <button
                onClick={() => setShowPlayersList(!showPlayersList)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.3s ease'
                }}
              >
                <span>👥 Players ({gameState.players.length}) • 📸 {gameState.totalPhotos} photos</span>
                <span style={{ fontSize: '1.2rem', transition: 'transform 0.3s ease', transform: showPlayersList ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              </button>

              {showPlayersList && (
                <div className="players-list" style={{ marginTop: '8px', animation: 'slideDown 0.3s ease' }}>
                  {gameState.players.map((player) => (
                    <div key={player.id} className="player-item">
                      <span>
                        {player.name}
                        {player.isHost && <span className="host-badge">👑 Host</span>}
                      </span>
                      <span>{player.photosUploaded || 0} photos</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="photo-upload" style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>📸 Upload Your Photos</h3>

              {/* Mode Toggle */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <button
                  className={`button ${uploadMode === 'manual' ? 'button-primary' : 'button-secondary'}`}
                  onClick={() => setUploadMode('manual')}
                  style={{ flex: 1, fontSize: '0.85rem', padding: '10px 16px' }}
                >
                  📷 Manual
                </button>
                <button
                  className={`button ${uploadMode === 'auto' ? 'button-primary' : 'button-secondary'}`}
                  onClick={() => setUploadMode('auto')}
                  style={{ flex: 1, fontSize: '0.85rem', padding: '10px 16px' }}
                >
                  🎲 Random
                </button>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById('photo-input-multiple')?.click()}
                className="photo-upload-zone"
              >
                <p style={{ textAlign: 'center', margin: 0, fontSize: '0.9rem' }}>
                  {uploadMode === 'manual' ? '📷 Select photos' : '🎲 Shuffle & upload all'}
                </p>
                <input
                  id="photo-input-multiple"
                  type="file"
                  accept="image/*"
                  onChange={handleMultipleFileSelect}
                  className="hidden-input"
                  multiple
                />
              </div>

              {loading && uploadProgress > 0 && (
                <div className="upload-progress">
                  <div className="upload-progress-bar">
                    <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.9rem' }}>
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              {uploadedPhotos.length > 0 && !loading && (
                <div style={{ marginTop: '12px', fontSize: '0.9rem' }}>
                  <p>✅ Uploaded: {uploadedPhotos.length} photos</p>
                </div>
              )}
            </div>

            {/* Total Photos Display */}
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              textAlign: 'center',
              fontSize: '0.95rem',
              fontWeight: '600'
            }}>
              📸 Total Photos: {gameState.totalPhotos}
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {isHost && gameState.canStartGame && (
                <button
                  className="button button-primary"
                  onClick={startGame}
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Starting...' : '🎮 Start Game!'}
                </button>
              )}

              {!isHost && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  fontSize: '0.9rem',
                  opacity: 0.9
                }}>
                  ⏳ Waiting for host to start...
                </div>
              )}

              <button
                className="button button-secondary"
                onClick={resetGame}
                style={{ width: '100%' }}
              >
                Leave Game
              </button>
            </div>
          </div>
        )}

        {currentView === 'game' && currentPhoto && (
          <div>
            <div style={{
              textAlign: 'center',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              fontSize: window.innerWidth <= 768 ? '0.9rem' : '1rem'
            }}>
              <span style={{ fontWeight: '600' }}>
                Photo {currentPhoto.photoIndex}/{currentPhoto.totalPhotos}
              </span>
              <span style={{
                fontSize: window.innerWidth <= 768 ? '1.3rem' : '1.5rem',
                fontWeight: 'bold',
                color: timeRemaining <= 5 ? '#ff4444' : '#fff',
              }}>
                ⏱️ {timeRemaining}s
              </span>
            </div>

            <img
              src={currentPhoto.photoUrl.startsWith('http') ? currentPhoto.photoUrl : `${API_BASE}${currentPhoto.photoUrl}`}
              alt="Guess whose photo"
              className="game-photo"
            />

            {!photoResults && (
              <>
                <h3 style={{
                  textAlign: 'center',
                  marginBottom: '12px',
                  fontSize: window.innerWidth <= 768 ? '1.1rem' : '1.3rem',
                  fontWeight: '600'
                }}>
                  Whose photo is this?
                </h3>

                {!hasSubmittedGuess && (
                  <div className="players-grid">
                    {currentPhoto.players.map((player) => (
                      <button
                        key={player.id}
                        className="player-button"
                        onClick={() => submitGuess(player.id)}
                      >
                        {player.name}
                      </button>
                    ))}
                  </div>
                )}

                {hasSubmittedGuess && (
                  <div style={{
                    textAlign: 'center',
                    padding: window.innerWidth <= 768 ? '20px' : '32px',
                    background: 'rgba(34, 197, 94, 0.15)',
                    borderRadius: '20px',
                    border: '2px solid rgba(34, 197, 94, 0.4)',
                    marginTop: window.innerWidth <= 768 ? '12px' : '20px'
                  }}>
                    <div style={{
                      fontSize: window.innerWidth <= 768 ? '2.5rem' : '3rem',
                      marginBottom: window.innerWidth <= 768 ? '8px' : '12px'
                    }}>✓</div>
                    <div style={{
                      fontSize: window.innerWidth <= 768 ? '1.1rem' : '1.2rem',
                      fontWeight: '600',
                      color: '#bbf7d0'
                    }}>
                      Guess Submitted!
                    </div>
                    <div style={{
                      fontSize: window.innerWidth <= 768 ? '0.85rem' : '0.9rem',
                      marginTop: '8px',
                      opacity: 0.9
                    }}>
                      Waiting for other players...
                    </div>
                  </div>
                )}
              </>
            )}

            {photoResults && (
              <div style={{ textAlign: 'center' }}>
                <h3 style={{
                  fontSize: window.innerWidth <= 768 ? '1.2rem' : '1.5rem',
                  marginBottom: window.innerWidth <= 768 ? '12px' : '20px'
                }}>
                  ✓ Correct: {photoResults.correctPlayer}
                </h3>

                {/* Show who guessed what */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '20px',
                  padding: window.innerWidth <= 768 ? '14px' : '20px',
                  marginBottom: window.innerWidth <= 768 ? '16px' : '24px',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}>
                  <h4 style={{
                    marginBottom: window.innerWidth <= 768 ? '12px' : '16px',
                    fontSize: window.innerWidth <= 768 ? '1rem' : '1.1rem',
                    opacity: 0.9
                  }}>
                    Round Results
                  </h4>
                  {photoResults.guesses.map((guess, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: window.innerWidth <= 768 ? '8px 10px' : '12px 16px',
                      marginBottom: window.innerWidth <= 768 ? '6px' : '8px',
                      background: guess.correct
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                      borderRadius: '12px',
                      border: `2px solid ${guess.correct ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.3)'}`,
                      fontSize: window.innerWidth <= 768 ? '0.85rem' : '0.95rem'
                    }}>
                      <span style={{ fontWeight: '600' }}>
                        {guess.correct ? '✓' : '✗'} {guess.guesser}
                      </span>
                      <span style={{
                        opacity: 0.9,
                        fontSize: window.innerWidth <= 768 ? '0.8rem' : '0.9rem'
                      }}>
                        → {guess.guessed}
                      </span>
                      <span style={{
                        fontSize: window.innerWidth <= 768 ? '0.75rem' : '0.85rem',
                        opacity: 0.8,
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: window.innerWidth <= 768 ? '3px 6px' : '4px 8px',
                        borderRadius: '8px'
                      }}>
                        {guess.timeToAnswer?.toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>

                <div className="leaderboard results-container">
                  <h4 style={{
                    fontSize: window.innerWidth <= 768 ? '1rem' : '1.2rem',
                    marginBottom: window.innerWidth <= 768 ? '12px' : '16px'
                  }}>
                    📊 Leaderboard
                  </h4>
                  {photoResults.leaderboard.map((player, index) => (
                    <div key={index} className="leaderboard-item">
                      <span className="rank">#{index + 1}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        {player.name}
                        {player.streak && player.streak >= 3 && (
                          <span className="streak-badge">
                            🔥 {player.streak}
                          </span>
                        )}
                      </span>
                      <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{player.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'results' && photoResults && (
          <div style={{ textAlign: 'center' }}>
            <h2>🎉 Game Finished!</h2>
            
            <div className="leaderboard results-container">
              <h3>Final Results</h3>
              {photoResults.leaderboard.map((player, index) => (
                <div key={index} className="leaderboard-item">
                  <span className="rank">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {player.name}
                    {player.streak && player.streak >= 3 && (
                      <span className="streak-badge">
                        🔥 {player.streak}
                      </span>
                    )}
                  </span>
                  <span style={{ fontWeight: '700' }}>{player.score} pts</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                className="button button-primary"
                onClick={playAgain}
              >
                🔄 Play Again
              </button>
              <button
                className="button button-secondary"
                onClick={resetGame}
              >
                Leave Game
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
