import React, { useState } from 'react';
import './FloatingLeaderboard.css';

interface LeaderboardPlayer {
  name: string;
  score: number;
  streak?: number;
}

interface FloatingLeaderboardProps {
  players: LeaderboardPlayer[];
  onClose?: () => void;
}

const FloatingLeaderboard: React.FC<FloatingLeaderboardProps> = ({ players, onClose }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const getRankDisplay = (index: number): string => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const getRankClass = (index: number): string => {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return '';
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <div className={`floating-leaderboard ${isMinimized ? 'minimized' : ''}`}>
      <div className="floating-leaderboard-card">
        <div className="leaderboard-header" onClick={toggleMinimize}>
          <h3 className="leaderboard-title">
            <span>📊</span>
            <span>Leaderboard</span>
          </h3>
          <div className="leaderboard-controls">
            <button
              className="control-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleMinimize();
              }}
              aria-label={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? '▲' : '▼'}
            </button>
            {onClose && (
              <button
                className="control-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="leaderboard-content">
          {players.map((player, index) => (
            <div
              key={`${player.name}-${index}`}
              className="floating-leaderboard-item"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className={`rank-badge ${getRankClass(index)}`}>
                {getRankDisplay(index)}
              </div>

              <div className="player-info">
                <div className="player-name">
                  <span>{player.name}</span>
                  {player.streak && player.streak >= 3 && (
                    <span className="streak-indicator">
                      <span>🔥</span>
                      <span>{player.streak}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="score-display">
                <div className="score-points">{player.score}</div>
                <div className="score-label">pts</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FloatingLeaderboard;
