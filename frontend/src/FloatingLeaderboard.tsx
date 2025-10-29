import React, { useState, useEffect } from 'react';
import './FloatingLeaderboard.css';

interface LeaderboardPlayer {
  name: string;
  score: number;
  streak?: number;
}

interface FloatingLeaderboardProps {
  players: LeaderboardPlayer[];
}

const FloatingLeaderboard: React.FC<FloatingLeaderboardProps> = ({ players }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Auto-hide after 4 seconds
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 4000);

    return () => {
      clearTimeout(fadeTimer);
    };
  }, []);

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

  return (
    <div className={`floating-leaderboard ${isFadingOut ? 'fading-out' : ''}`}>
      <div className="floating-leaderboard-card">
        <div className="leaderboard-header">
          <h3 className="leaderboard-title">
            <span>📊</span>
            <span>Leaderboard</span>
          </h3>
        </div>

        <div className="leaderboard-content">
          {players.slice(0, 5).map((player, index) => (
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
