import React from 'react';
import './LiveRoomBadge.css';

interface LiveRoomBadgeProps {
  gameState: string;
  isVisible: boolean;
}

const LiveRoomBadge: React.FC<LiveRoomBadgeProps> = ({ gameState, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="live-room-badge">
      <div className="badge-indicator">
        <span className="pulse-dot"></span>
        <span className="badge-text">LIVE ROOM</span>
      </div>

      <div className="badge-status">
        <span className="status-text">Photos auto-delete after game</span>
      </div>
    </div>
  );
};

export default LiveRoomBadge;
