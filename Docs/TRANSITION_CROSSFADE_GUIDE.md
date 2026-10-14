# 🎬 Guide: 1-Second Cross-Dissolve & Transition Buffer in One Tap

## 📖 Introduction: Why Was This Added?

When you add a title, thumbnail, or intro video to a main recording, standard video transitions (like cross-dissolve or fade-in) usually **cut into the first 1–2 seconds of the main video**.
- In standard editors or scripts, this often cuts off the speaker's first words (e.g., cutting off *"Aaj...", "Bismillah...", or "Welcome..."*) or loses the initial live motion.
- **One Tap solves this problem** with an **intelligent 1.0-second transition buffer**.

---

## 💡 How It Works (In Simple Words)

1. **The 1-Second Safe Buffer**:
   - One Tap inserts an exact 1.0-second visual transition frame between your title/intro and your main video.
   - This frame acts as a **visual bridge**.

2. **Main Video is 100% Preserved (Zero Content Loss)**:
   - Your main video starts at **frame 0, second 0.0**.
   - Not a single millisecond of the speaker's speech, audio, or footage is deleted or cropped.

3. **Audio Invariance (No Extra Music or Noise)**:
   - The 1-second transition buffer is **purely visual** (`v=1:a=0`).
   - One Tap **does NOT add any extra sound effects, whooshes, or music** on top of your video.
   - The main audio begins smoothly in exact sync right as the video plays.

4. **Smooth Cross-Dissolve**:
   - The visual transition fades smoothly from the title into the 1-second buffer and into the main footage, giving a clean, broadcast-grade television look.

---

## 📁 File Naming & Where to Put It

You have two simple options:

### Option A: Automatic Built-in (Recommended — No file needed)
If you don't provide any file, One Tap automatically generates a broadcast-standard **deep black cinematic frame** formatted to match your video resolution (1080p, 4K, 16:9 or 9:16) and frame rate. It looks clean, professional, and works out of the box.

### Option B: Custom Black Image or Transition Video
If you want to use your own custom black image, logo frame, or transition clip:
1. Place the file inside your **Titles Folder** (the same folder where your intros, thumbnails, or background music are located).
2. Save it with any of the following standard names:

| Type | Accepted File Names | What Happens |
| :--- | :--- | :--- |
| **Video Clip** | `transition.mp4`<br>`black.mp4`<br>`fade.mp4` | If the video is longer than 1 second (e.g. 2.5s or 3s), **One Tap automatically uses only the first 1.0 second**, keeping your timing perfect. |
| **Image** | `transition.png` / `transition.jpg`<br>`black.png` / `black.jpg`<br>`fade.png` / `fade.jpg` | One Tap expands the image into a seamless 1.0-second video frame matching your output resolution. |

---

## 🚀 How to Use It in One Tap

1. **Open Title Adder** in One Tap.
2. Ensure your **Titles Folder** and **Raw Videos** are selected.
3. In the Processing / Settings panel, verify that **Cross Dissolve** or **Transition Buffer** is checked/active.
4. Hit **Process Videos**.
5. One Tap will:
   - Render the title intro.
   - Apply the 1.0s visual buffer with cross-dissolve.
   - Preserve 100% of your main video footage and voice.
   - Automatically update the task in **Task Tracker** to `upload_pending` with video duration and file size upon completion!

---

## ❓ Frequently Asked Questions (FAQ)

### Q: Will my speaker's voice get cut off?
**No.** The live audio begins at frame 0 with exact time alignment delayed by `(introDuration + 1.0s)`. None of the speech is trimmed.

### Q: Does it play any sound during the 1-second black frame?
**No.** The 1-second buffer is silent. Only your configured intro music (if any) or silence precedes the speaker's live audio.

### Q: What if my transition video is 3 seconds long?
One Tap automatically trims it to **exactly 1.0 second** so that your render doesn't get delayed and the flow stays fast and snappy.
