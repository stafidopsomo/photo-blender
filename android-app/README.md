# 📱 Photo Roulette Android App (WebView Wrapper)

Simple Android WebView wrapper that loads your Photo Roulette React web app.

## Features

- ✅ Opens your React web app in native Android app
- ✅ Full camera access for photo capture
- ✅ Gallery access for photo selection
- ✅ Users install from Google Play (not browser)
- ✅ Small APK size (~2MB)
- ✅ Auto-updates when you update web app

## How It Works

This is a **WebView wrapper** - it simply loads your existing React web app inside a native Android WebView. Think of it as a mini-browser specifically for your app.

**Benefits:**
- No code duplication
- Easy to maintain (update web = update app)
- Quick to build and deploy
- Native photo/camera access

## Setup

### 1. Configure URL

Edit `app/src/main/java/com/photoroulette/MainActivity.java`:

```java
// For local testing (Android Emulator)
private static final String WEB_APP_URL = "http://10.0.2.2:3000";

// For production (your Render deployment)
private static final String WEB_APP_URL = "https://your-app.onrender.com";
```

### 2. Build APK

**Option A: Using Android Studio (Recommended)**
1. Open Android Studio
2. File → Open → Select `android-app` folder
3. Build → Build Bundle(s) / APK(s) → Build APK(s)
4. APK location: `app/build/outputs/apk/release/app-release.apk`

**Option B: Command Line**
```bash
cd android-app
./gradlew assembleRelease
# APK: app/build/outputs/apk/release/app-release-unsigned.apk
```

### 3. Test on Device

**Install via USB:**
```bash
adb install app/build/outputs/apk/release/app-release.apk
```

**Or transfer APK to phone and install manually**

## Permissions

The app requests:
- 📷 Camera access (for taking photos)
- 🖼️ Gallery access (for selecting photos)
- 🌐 Internet access (to load web app)

## Production Deployment

### Google Play Store

1. **Sign the APK:**
```bash
# Generate keystore (one time)
keytool -genkey -v -keystore photo-roulette.keystore -alias photo-roulette -keyalg RSA -keysize 2048 -validity 10000

# Sign APK
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore photo-roulette.keystore app-release-unsigned.apk photo-roulette
```

2. **Create Play Store listing:**
- Go to Google Play Console
- Create new app
- Upload signed APK
- Fill in app details, screenshots, etc.
- Submit for review

### Alternative: Direct APK Distribution

Share the APK file directly:
- Upload to your website
- Send via email/messaging
- Host on GitHub releases

**Note:** Users must enable "Install from Unknown Sources" in Android settings.

## File Structure

```
android-app/
├── app/
│   ├── src/main/
│   │   ├── java/com/photoroulette/
│   │   │   └── MainActivity.java      # Main WebView logic
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   └── activity_main.xml  # WebView layout
│   │   │   └── values/
│   │   │       ├── strings.xml
│   │   │       └── styles.xml
│   │   └── AndroidManifest.xml        # Permissions & config
│   └── build.gradle                    # App dependencies
├── build.gradle                        # Project config
└── settings.gradle                     # Gradle settings
```

## Troubleshooting

**WebView shows blank screen:**
- Check URL is correct in MainActivity.java
- Ensure backend is running
- Check internet permissions in AndroidManifest.xml

**Camera/Gallery not working:**
- Grant permissions when prompted
- Check permissions in Android Settings → Apps → Photo Roulette

**Can't upload multiple photos:**
- This is already enabled via `Intent.EXTRA_ALLOW_MULTIPLE` in MainActivity.java

## Advantages vs Full Native App

**WebView Wrapper (This approach):**
- ✅ 1-2 hours to build
- ✅ Small code to maintain
- ✅ Updates automatically with web app
- ❌ Less "native" feel
- ❌ Requires internet connection

**Full Native (Flutter/React Native):**
- ✅ True native experience
- ✅ Better performance
- ✅ Offline capability
- ❌ Weeks to build
- ❌ Duplicate code to maintain

## Next Steps

1. **Test locally** with emulator or device
2. **Deploy web app** to Render
3. **Update WEB_APP_URL** to production URL
4. **Build release APK**
5. **Submit to Play Store** or distribute directly

---

**This is perfect for getting your app on user phones quickly while keeping your existing React codebase!**
