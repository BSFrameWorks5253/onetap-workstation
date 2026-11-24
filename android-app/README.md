# One Tap Studio Mobile Tracker (Android / Kotlin)

Native Android mobile application for **One Tap Studio Media Workstation**, built with **Kotlin** and **Jetpack Compose (Material 3)**.

---

## 📱 Features

1. **Executive Command Dashboard**:
   - Real-time campaign overview (e.g. `1447-06 Safar Mubaraka - Mumbai`).
   - Dynamic multi-stage color progress bar (Amber → Blue → Cyan → Emerald).
   - Milestone banner celebration when 100% of dates & photos are delivered.
   - Global production KPI matrix (Total Days, Editing Pending, In Progress, Upload Pending, Delivered Videos, Safars 100% Done).
   - Expandable scheduled dates list with compact date rows.

2. **Daily WhatsApp Briefing Engine**:
   - **Infographic Card Mode**: Dynamically renders a 1080px high-resolution status graphic using Android `Canvas` with gradient backgrounds, progress metrics, and timeline breakdown, shareable directly to WhatsApp contacts or groups.
   - **Executive Text Mode**: Formatted WhatsApp message with custom icons/emojis, completion percentage bar, and date-by-date breakdown.

3. **Production Pipeline (Kanban)**:
   - Filterable pipeline stages: *Editing Pending*, *In Progress*, *Upload Pending*, *Uploaded*, *AlJamea Done*.
   - Instant stage advance and regress controls.
   - Video editor assignment and video duration badges.
   - Direct shortcuts to Google Drive folders.

4. **Google Drive Photo Tracker**:
   - Master photo archive sync tracker.
   - Live percentage counter and step adjusters (`-10`, `+10`, `All Done`).
   - Direct Google Drive folder links per event date.

---

## 🛠️ Architecture & Tech Stack

- **Language**: Kotlin 1.9.22
- **UI Toolkit**: Jetpack Compose BOM 2024.02.02 + Material 3
- **Navigation**: Navigation Compose 2.7.7
- **Reactive State**: Kotlin Coroutines & `StateFlow`
- **Graphics**: Hardware-accelerated Android `Canvas` & `FileProvider`
- **Architecture**: Modern MVVM / Single-Directional Data Flow (UDF)
- **Minimum SDK**: Android 8.0 (API level 26)
- **Target SDK**: Android 14 (API level 34)

---

## 🚀 Opening in Android Studio

1. Open **Android Studio** (Hedgehog, Iguana, or Jellyfish).
2. Select **Open** and choose the `android-app` folder.
3. Allow Gradle to sync dependencies.
4. Select an emulator or connected device and click **Run (Shift + F10)**.

To build an APK via terminal:
```bash
./gradlew assembleDebug
```
The output APK will be generated at `app/build/outputs/apk/debug/app-debug.apk`.
