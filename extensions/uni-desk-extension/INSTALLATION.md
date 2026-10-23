# Uni_Desk Extension — Installation & Setup Guide

This guide explains how to install and enable **Uni_Desk Command Palette Extension** in Adobe Premiere Pro.

---

## 1. Enable Unsigned CEP Extensions (PlayerDebugMode)

Adobe Premiere Pro requires `PlayerDebugMode` enabled to load CEP extensions during development.

### Windows (PowerShell)
Run PowerShell as Administrator or current user and execute:

```powershell
# For Premiere Pro 2024 / CEP 12
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.12" -Name "PlayerDebugMode" -Value "1"

# For Premiere Pro 2025 / CEP 13
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.13" -Name "PlayerDebugMode" -Value "1"

# For Premiere Pro 2026 / CEP 14
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.14" -Name "PlayerDebugMode" -Value "1"
```

### macOS (Terminal)
```bash
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
defaults write com.adobe.CSXS.13 PlayerDebugMode 1
defaults write com.adobe.CSXS.14 PlayerDebugMode 1
```

---

## 2. Deploy Extension to Adobe CEP Extensions Folder

Copy or symlink `uni-desk-extension` into Adobe's system extensions directory.

### Windows Path:
`C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\uni-desk-extension`  
*or*  
`C:\Users\<YourUsername>\AppData\Roaming\Adobe\CEP\extensions\uni-desk-extension`

### macOS Path:
`/Library/Application Support/Adobe/CEP/extensions/uni-desk-extension`  
*or*  
`~/Library/Application Support/Adobe/CEP/extensions/uni-desk-extension`

---

## 3. Build & Launch in Premiere Pro

1. In `extensions/uni-desk-extension`, compile the frontend production bundle:
   ```bash
   npm install
   npm run build
   ```
2. Open **Adobe Premiere Pro**.
3. Go to top menu: **Window ➔ Extensions ➔ Uni_Desk Command Palette**.
4. Press `CTRL + SPACE` inside the panel to trigger the Command Palette overlay!

---

## Troubleshooting

- **Panel shows blank white screen**: Ensure `npm run build` was executed and `dist/index.html` exists.
- **Effect doesn't apply to clip**: Make sure a clip is selected on the active timeline sequence. Uni_Desk will display a toast prompt: *"No clip selected in active sequence."*
