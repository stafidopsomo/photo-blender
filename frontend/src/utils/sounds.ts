// Simple Web Audio API sound generator
class SoundEffects {
  private audioContext: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Create audio context on first user interaction
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new AudioContext();
    }
  }

  private ensureAudioContext() {
    if (!this.audioContext && typeof window !== 'undefined') {
      this.audioContext = new AudioContext();
    }
    // Resume if suspended (required for some browsers)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('soundsMuted', muted.toString());
    }
  }

  getMuted(): boolean {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('soundsMuted');
      return stored === 'true';
    }
    return false;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    if (this.isMuted || !this.audioContext) return;

    this.ensureAudioContext();
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // Button click sound
  click() {
    this.playTone(800, 0.05, 'sine', 0.2);
  }

  // Success sound (correct guess)
  success() {
    if (this.isMuted || !this.audioContext) return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    // Play ascending notes
    this.playTone(523, 0.1, 'sine', 0.3); // C
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.3), 100); // E
    setTimeout(() => this.playTone(784, 0.15, 'sine', 0.3), 200); // G
  }

  // Error sound (wrong guess)
  error() {
    if (this.isMuted || !this.audioContext) return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    // Play descending buzzy notes
    this.playTone(300, 0.1, 'square', 0.2);
    setTimeout(() => this.playTone(200, 0.15, 'square', 0.2), 100);
  }

  // Notification sound (photo uploaded, game start, etc.)
  notification() {
    if (this.isMuted || !this.audioContext) return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    this.playTone(600, 0.08, 'sine', 0.25);
    setTimeout(() => this.playTone(800, 0.08, 'sine', 0.25), 80);
  }

  // Timer warning (when time is low)
  timerWarning() {
    if (this.isMuted || !this.audioContext) return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    this.playTone(1000, 0.1, 'triangle', 0.3);
  }

  // Countdown tick
  tick() {
    this.playTone(400, 0.03, 'sine', 0.15);
  }

  // Game finished sound
  gameFinish() {
    if (this.isMuted || !this.audioContext) return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    // Victory fanfare
    this.playTone(523, 0.12, 'sine', 0.3); // C
    setTimeout(() => this.playTone(659, 0.12, 'sine', 0.3), 120); // E
    setTimeout(() => this.playTone(784, 0.12, 'sine', 0.3), 240); // G
    setTimeout(() => this.playTone(1047, 0.2, 'sine', 0.3), 360); // C high
  }
}

// Haptic feedback for mobile devices
class HapticFeedback {
  private isSupported: boolean;

  constructor() {
    this.isSupported = 'vibrate' in navigator;
  }

  // Light tap
  light() {
    if (this.isSupported) {
      navigator.vibrate(10);
    }
  }

  // Medium tap
  medium() {
    if (this.isSupported) {
      navigator.vibrate(20);
    }
  }

  // Strong tap
  strong() {
    if (this.isSupported) {
      navigator.vibrate(40);
    }
  }

  // Success pattern
  success() {
    if (this.isSupported) {
      navigator.vibrate([10, 50, 10, 50, 15]);
    }
  }

  // Error pattern
  error() {
    if (this.isSupported) {
      navigator.vibrate([30, 50, 30]);
    }
  }

  // Warning pattern
  warning() {
    if (this.isSupported) {
      navigator.vibrate([20, 30, 20]);
    }
  }
}

// Export singleton instances
export const sounds = new SoundEffects();
export const haptics = new HapticFeedback();
