# 📸 Photo Roulette Mobile

Flutter mobile app (iOS & Android) for Photo Roulette - A fun party game where players upload photos and guess whose photo is being displayed!

## ✨ Features

- 📱 **Native Mobile App** for iOS and Android
- 📷 **Full Camera Access** - Take photos directly in the app
- 🖼️ **Native Gallery Access** - Choose photos from your device
- 🎮 **Real-time Multiplayer** - Play with up to 8 players
- ⏱️ **30-second Timer** per photo with auto-skip
- 🏆 **Advanced Scoring** with time bonuses and streak multipliers
- 👑 **Host Controls** - Room creator starts the game
- 🎨 **Beautiful Dark Theme** UI

## 🛠️ Prerequisites

- Flutter SDK (v3.35.5 or higher)
- Dart SDK (v3.9.2 or higher)
- Android Studio (for Android development)
- Xcode (for iOS development - Mac only)
- Node.js backend running (see main README)

## 🚀 Getting Started

### 1. Install Flutter

If you haven't installed Flutter yet:

```bash
# Clone Flutter SDK
git clone https://github.com/flutter/flutter.git -b stable
export PATH="$PATH:`pwd`/flutter/bin"

# Run Flutter doctor to check setup
flutter doctor
```

### 2. Install Dependencies

```bash
cd mobile
flutter pub get
```

### 3. Configure Backend URL

Update the backend URL in `lib/services/api_service.dart`:

```dart
// For Android Emulator (local development)
static const String baseUrl = 'http://10.0.2.2:5000';

// For iOS Simulator (local development)
static const String baseUrl = 'http://localhost:5000';

// For Production (your Render URL)
static const String baseUrl = 'https://your-app.onrender.com';
```

### 4. Run the App

**Android Emulator:**
```bash
flutter run
```

**iOS Simulator (Mac only):**
```bash
flutter run
```

**Physical Device:**
```bash
# Connect device via USB
flutter devices  # List connected devices
flutter run -d <device-id>
```

## 📱 Building for Release

### Android APK

```bash
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

### Android App Bundle (for Google Play)

```bash
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab
```

### iOS (Mac only)

```bash
flutter build ios --release
# Then open ios/Runner.xcworkspace in Xcode
# Archive and upload to App Store
```

## 🏗️ Project Structure

```
mobile/
├── lib/
│   ├── main.dart                    # App entry point
│   ├── models/                      # Data models
│   │   ├── player.dart
│   │   ├── game_state.dart
│   │   ├── photo_data.dart
│   │   └── photo_results.dart
│   ├── services/                    # Backend communication
│   │   ├── api_service.dart         # HTTP API calls
│   │   └── socket_service.dart      # Socket.io real-time
│   └── screens/                     # UI screens
│       ├── home_screen.dart         # Create/Join room
│       ├── lobby_screen.dart        # Waiting room + photo upload
│       ├── game_screen.dart         # Gameplay + guessing
│       └── results_screen.dart      # Final leaderboard
├── android/                         # Android-specific code
├── ios/                            # iOS-specific code
└── pubspec.yaml                    # Dependencies

```

## 🔐 Permissions

### Android (Already Configured)
- Camera access
- Photo library access
- Internet access

### iOS (Already Configured)
- Camera usage description
- Photo library usage description
- Microphone access (for video)

## 🎮 How to Play

1. **Launch the app**
2. **Enter your name**
3. **Create a room** (become host) or **Join a room** with code
4. **Upload photos** - Use camera or gallery (5+ photos recommended)
5. **Host starts the game** when 2+ players have uploaded 10+ total photos
6. **Guess the photos** - 30 seconds per photo
7. **View results** - See who won with scores and streaks!

## 🔧 Backend Connection

This mobile app connects to the same Node.js backend as the React web app:

- **Local Development**: Backend must be running on `localhost:5000`
- **Production**: Backend deployed on Render
- **API Endpoints**: Same as web version (create-room, join-room, upload-photo, etc.)
- **Socket.io**: Real-time events for game state, photos, results

## 📦 Dependencies

- `flutter` - Framework
- `socket_io_client` - Real-time communication
- `http` - HTTP requests
- `image_picker` - Camera and gallery access
- `provider` - State management
- `uuid` - Unique identifiers

## 🐛 Troubleshooting

**Android Emulator can't reach localhost:**
- Use `10.0.2.2` instead of `localhost` in `api_service.dart`

**iOS Simulator can't reach localhost:**
- Use `localhost` in `api_service.dart`
- Make sure backend allows connections from localhost

**Camera/Gallery not working:**
- Check permissions in AndroidManifest.xml and Info.plist
- Run `flutter clean` and rebuild

**Socket connection fails:**
- Check backend URL is correct
- Ensure backend is running
- Check CORS settings on backend

## 📄 License

MIT License - feel free to use this project for your own purposes!
