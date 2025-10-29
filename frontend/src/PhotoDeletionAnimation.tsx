import React, { useState, useEffect } from 'react';
import './PhotoDeletionAnimation.css';

interface PhotoDeletionAnimationProps {
  photos: string[]; // Array of photo URLs
  onComplete: () => void;
}

const PhotoDeletionAnimation: React.FC<PhotoDeletionAnimationProps> = ({ photos, onComplete }) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'flashing' | 'deleting' | 'complete'>('flashing');
  const [deletedPhotos, setDeletedPhotos] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (stage === 'flashing') {
      // Flash through photos quickly
      const flashInterval = setInterval(() => {
        setCurrentPhotoIndex((prev) => {
          if (prev >= photos.length - 1) {
            clearInterval(flashInterval);
            setStage('deleting');
            return 0;
          }
          return prev + 1;
        });
      }, 150); // 150ms per photo flash

      return () => clearInterval(flashInterval);
    } else if (stage === 'deleting') {
      // Delete photos one by one with progress
      const deleteInterval = setInterval(() => {
        setDeletedPhotos((prev) => {
          const newSet = new Set(prev);
          newSet.add(prev.size);

          const newProgress = ((prev.size + 1) / photos.length) * 100;
          setProgress(newProgress);

          if (prev.size + 1 >= photos.length) {
            clearInterval(deleteInterval);
            setTimeout(() => {
              setStage('complete');
              setTimeout(() => {
                onComplete();
              }, 2000); // Show complete message for 2s
            }, 500);
          }

          return newSet;
        });
      }, 100); // 100ms per photo deletion

      return () => clearInterval(deleteInterval);
    }
  }, [stage, photos.length, onComplete]);

  return (
    <div className="deletion-overlay">
      <div className="deletion-container">
        {stage === 'flashing' && (
          <div className="flashing-stage">
            <h2 className="deletion-title">🔄 Collecting Photos...</h2>
            <div className="photo-flash-container">
              {photos.map((photoUrl, index) => (
                <img
                  key={index}
                  src={photoUrl}
                  alt={`Photo ${index + 1}`}
                  className={`flash-photo ${index === currentPhotoIndex ? 'active' : ''}`}
                />
              ))}
            </div>
            <p className="deletion-subtitle">Found {photos.length} photos to delete</p>
          </div>
        )}

        {stage === 'deleting' && (
          <div className="deleting-stage">
            <h2 className="deletion-title">🗑️ Permanently Deleting Photos...</h2>

            <div className="deletion-grid">
              {photos.map((photoUrl, index) => (
                <div
                  key={index}
                  className={`deletion-photo ${deletedPhotos.has(index) ? 'deleted' : ''}`}
                >
                  <img src={photoUrl} alt={`Photo ${index + 1}`} />
                  {deletedPhotos.has(index) && (
                    <div className="deleted-overlay">
                      <span className="deleted-icon">✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="progress-text">
                {deletedPhotos.size} / {photos.length} photos deleted
              </p>
            </div>
          </div>
        )}

        {stage === 'complete' && (
          <div className="complete-stage">
            <div className="success-icon">✓</div>
            <h2 className="success-title">All Photos Deleted!</h2>
            <p className="success-subtitle">
              {photos.length} photos have been permanently removed from our servers
            </p>
            <div className="success-badges">
              <div className="success-badge">
                <span>🔒</span> Zero traces left
              </div>
              <div className="success-badge">
                <span>🛡️</span> Privacy protected
              </div>
              <div className="success-badge">
                <span>✨</span> Memory cleared
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoDeletionAnimation;
