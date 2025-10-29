import React from 'react';
import './PrivacyPopup.css';

interface PrivacyPopupProps {
  onClose: () => void;
}

const PrivacyPopup: React.FC<PrivacyPopupProps> = ({ onClose }) => {

  return (
    <div className="privacy-overlay">
      <div className="privacy-popup">
        <div className="privacy-header">
          <div className="privacy-icon">🛡️</div>
          <h2>Your Privacy is Protected</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="privacy-content">
          <div className="privacy-feature">
            <div className="feature-icon">🔥</div>
            <div className="feature-text">
              <h3>Photos are TEMPORARY</h3>
              <p>Your photos only exist during the game. They're automatically deleted from our servers 10 minutes after the game ends.</p>
            </div>
          </div>

          <div className="privacy-feature">
            <div className="feature-icon">🗑️</div>
            <div className="feature-text">
              <h3>Watch Them Disappear</h3>
              <p>At the end of each game, you'll see a visual confirmation showing all photos being permanently deleted.</p>
            </div>
          </div>

          <div className="privacy-feature">
            <div className="feature-icon">📍</div>
            <div className="feature-text">
              <h3>Metadata Stripped</h3>
              <p>GPS location, device info, and all metadata are automatically removed from your photos before the game starts.</p>
            </div>
          </div>

          <div className="privacy-feature">
            <div className="feature-icon">🚫</div>
            <div className="feature-text">
              <h3>No Tracking, No Storage</h3>
              <p>No account required. No permanent storage. No backups. Your photos are never saved to a database.</p>
            </div>
          </div>

          <div className="privacy-guarantee">
            <div className="guarantee-badge">
              <span className="badge-icon">✓</span>
              <span className="badge-text">100% Privacy Guaranteed</span>
            </div>
            <p className="guarantee-subtext">
              Photo Blender is designed for ephemeral fun. Your memories stay yours.
            </p>
          </div>
        </div>

        <div className="privacy-footer">
          <button className="got-it-btn" onClick={onClose}>
            Got It! 🎮
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPopup;
