import React from 'react';
import './TutorialPopup.css';

interface TutorialPopupProps {
  onClose: () => void;
}

const TutorialPopup: React.FC<TutorialPopupProps> = ({ onClose }) => {

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-popup">
        <div className="tutorial-header">
          <h2>🎮 Welcome to Photo Blender!</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="tutorial-content">
          <div className="tutorial-section">
            <h3>📸 How to Play</h3>
            <ol>
              <li><strong>Create or Join a Room:</strong> Start by creating a new room or joining an existing one with a 6-digit code.</li>
              <li><strong>Upload Photos:</strong> Each player uploads photos from their device (at least 5 photos recommended).</li>
              <li><strong>Start the Game:</strong> The room host starts the game when everyone is ready (minimum 2 players, 10 total photos).</li>
              <li><strong>Guess Who:</strong> Photos are shown one by one - guess which player took each photo within 30 seconds!</li>
              <li><strong>Scoring:</strong> Earn points for correct guesses, speed bonuses for being fast, and streak bonuses for consecutive correct answers.</li>
            </ol>
          </div>

          <div className="tutorial-section">
            <h3>🏆 Scoring System</h3>
            <ul>
              <li><strong>Base Points:</strong> 100 points for each correct guess</li>
              <li><strong>Speed Bonus:</strong> Up to +100 points for the 3 fastest correct answers</li>
              <li><strong>Streak Bonus:</strong> +10 points per streak level after 3 consecutive correct guesses (3 streak = +30, 4 streak = +40, etc.)</li>
            </ul>
          </div>

          <div className="tutorial-section">
            <h3>💡 Tips</h3>
            <ul>
              <li>More players = more fun! Invite 3-8 friends</li>
              <li>Upload diverse photos that represent your style</li>
              <li>The timer turns red at 5 seconds - act fast!</li>
              <li>Build streaks for bonus points</li>
              <li>Only the room host can start the game and reset after finishing</li>
            </ul>
          </div>

          <div className="tutorial-section">
            <h3>🎯 Quick Tips</h3>
            <ul>
              <li><strong>Auto-Skip:</strong> Round ends automatically when all players submit</li>
              <li><strong>Reconnection:</strong> If you disconnect, you can rejoin with your player ID</li>
              <li><strong>Privacy:</strong> All photo metadata (GPS, device info) is automatically removed</li>
            </ul>
          </div>
        </div>

        <div className="tutorial-footer">
          <button className="start-playing-btn" onClick={onClose}>
            Got it! 🚀
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialPopup;
