// ==WindhawkMod==
// @id              safar-folder-inspector
// @name            🏕️ Safar & Media Stats Inspector
// @description     Windows File Explorer Shell Extension for Safar folders: displays Total Days, Event breakdown (Q, N, Z, MZ, AQ, ZO, etc.), Premiere Pro timeline duration, and 1-click WhatsApp executive reports.
// @version         2.0.0
// @author          UniDesk / BS.Framework
// @include         explorer.exe
// @architecture    x86-64
// @compilerOptions -lcomctl32 -lpropsys -lole32 -loleaut32 -lshlwapi -lshell32 -luuid
// ==/WindhawkMod==

// ==WindhawkModReadme==
/*
# 🏕️ Safar & Media Stats Inspector (Windhawk Mod)

A professional Windows File Explorer Shell extension mod built for **Windhawk** to inspect Safar media folders, calculate Adobe Premiere Pro timeline durations, count days, and display official event segregation from `Event List.xlsx`.

---

## 🚀 Key Features

1. **Native Explorer Properties Tab:**
   - Appears as a dedicated **"🏕️ Safar & Media Stats"** tab inside the Windows File Explorer Properties dialog when right-clicking any Safar, Date, or Item folder.

2. **Explorer Right-Click Context Menu:**
   - Right-click ANY folder in Windows Explorer to see **"🏕️ Inspect Safar & Media Stats"**.
   - Instantly opens the Executive Inspector dialog with 1 click without needing to navigate properties tabs!

3. **Automatic Level Detection:**
   - **Level 1 (Safar Root):** e.g. `1448-10-Istefada ilmiyah` or `1447-08 Mumbai - Urs Mubarak`
     - Total Days in Safar (counts sessions like `_01M`, `_02E`).
     - Total Events recorded across all sessions.
     - Event breakdown chips (Q, N, Z, MZ, AQ, ZO, BM, etc.).
     - Total raw video duration (Adobe Premiere Pro timeline run-time estimate).
     - Total clips count and disk size.
   - **Level 2 (Date/Session):** e.g. `1448-04-18 _01M`
     - Morning vs Evening session classification.
     - Items count and clip run time.
     - Event breakdown chips.
   - **Level 3 (Individual Event/Item):** e.g. `1448-03-13 _01M-02-01N-30338708`
     - ITS ID, item index, event type, occurrence, person folder.

4. **Abbreviations vs Full Names Toggle:**
   - Displays concise abbreviations by default (`Q, N, Z, MZ, AQ, ZO`).
   - 1-click toggle to view the full official names (e.g. `N` ⇄ `Nikah`, `AQ` ⇄ `Aqiqa`, `MZ` ⇄ `Majmui Ziyafat`).

5. **Zero-Count Suppression:**
   - Categories with `0` records are completely hidden to eliminate visual clutter.

6. **1-Click WhatsApp Executive Summary Copy:**
   - Copies a beautifully formatted report with emojis to clipboard, ready to paste in WhatsApp.

7. **1-Click Open Studio Dashboard:**
   - Seamlessly opens the full Python/CustomTkinter GUI (`gui_inspector.py`) for visual charts and interactive filters.
*/
// ==/WindhawkModReadme==

// ==WindhawkModSettings==
/*
- showFullNamesByDefault: false
  $name: Show Full Official Event Names by Default
  $description: When enabled, full names like 'Nikah' and 'Majmui Ziyafat' are shown instead of abbreviations ('N', 'MZ').
- enableContextMenu: true
  $name: Explorer Context Menu Item
  $description: Add 'Inspect Safar & Media Stats' to Explorer folder right-click context menu.
- enableHotkey: true
  $name: Explorer Hotkey (Ctrl+Shift+S)
  $description: Press Ctrl+Shift+S in Explorer to inspect the currently selected folder.
- pythonGuiPath: "D:\\ON_GOING PROJECT\\One Tap_V20.6.5\\extensions\\windhawk-safar-inspector\\gui_inspector.py"
  $name: Studio GUI Dashboard Script Path
  $description: Absolute path to the python workstation dashboard script.
*/
// ==/WindhawkModSettings==

#include <windows.h>
#include <commctrl.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <propsys.h>
#include <propkey.h>
#include <exdisp.h>

#include <string>
#include <vector>
#include <map>
#include <algorithm>
#include <regex>
#include <sstream>
#include <iomanip>
#include <fstream>
#include <filesystem>

#ifndef WH_MOD_ID
#define WH_MOD_ID L"safar-folder-inspector"
#endif

#include <windhawk_api.h>
#include <windhawk_utils.h>

// Control IDs for the Inspector Dialog
#define IDC_SAFAR_TITLE       2001
#define IDC_SAFAR_LEVEL       2002
#define IDC_SAFAR_DAYS        2003
#define IDC_SAFAR_EVENTS      2004
#define IDC_SAFAR_TIMELINE    2005
#define IDC_SAFAR_LISTVIEW    2006
#define IDC_BTN_TOGGLE_NAMES  2007
#define IDC_BTN_COPY_SUMMARY  2008
#define IDC_BTN_OPEN_GUI      2009
#define IDC_SAFAR_PATH        2010

#define IDM_SAFAR_INSPECT     0x7E10
#define ID_HOTKEY_SAFAR       0x9E20

// ─────────────────────────────────────────────────────────────────────────────
// Mod Settings
// ─────────────────────────────────────────────────────────────────────────────
struct ModSettings {
    bool showFullNamesByDefault = false;
    bool enableContextMenu = true;
    bool enableHotkey = true;
    std::wstring pythonGuiPath = L"D:\\ON_GOING PROJECT\\One Tap_V20.6.5\\extensions\\windhawk-safar-inspector\\gui_inspector.py";
} settings;

void LoadSettings() {
    settings.showFullNamesByDefault = Wh_GetIntSetting(L"showFullNamesByDefault") != 0;
    settings.enableContextMenu = Wh_GetIntSetting(L"enableContextMenu") != 0;
    settings.enableHotkey = Wh_GetIntSetting(L"enableHotkey") != 0;

    PCWSTR pPyPath = Wh_GetStringSetting(L"pythonGuiPath");
    if (pPyPath && *pPyPath) {
        settings.pythonGuiPath = pPyPath;
        Wh_FreeStringSetting(pPyPath);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 34 Official Events from Event List.xlsx
// ─────────────────────────────────────────────────────────────────────────────
struct EventDefinition {
    const wchar_t* code;
    const wchar_t* name;
    unsigned int color; // 0x00RRGGBB
};

inline const std::vector<EventDefinition>& GetOfficialEvents() {
    static const std::vector<EventDefinition> s_events = {
        { L"AQ",     L"Aqiqa",                0x00D2FF },
        { L"BM",     L"Bethak Majlis",        0x14B8A6 },
        { L"BQ",     L"Bethak Qadam",         0xF43F5E },
        { L"BZ",     L"Bethak Ziyafat",       0xA855F7 },
        { L"FMB",    L"FMB",                  0x22C55E },
        { L"H",      L"Haddiyat",             0xF59E0B },
        { L"ID",     L"Idaraat",              0x2563EB },
        { L"IF",     L"Iftettah",             0x84CC16 },
        { L"IFS",    L"Iftettah Sharaf",      0x10B981 },
        { L"IST",    L"Isteqbal",             0x6366F1 },
        { L"KGS",    L"Kg Sharaf",            0xEC4899 },
        { L"M",      L"Majlis",               0x34C759 },
        { L"MF",     L"Mafsuhiyat",           0xB45309 },
        { L"MISBAH", L"Misbah",               0x06B6D4 },
        { L"MKB",    L"Mokib",                0x1E3A8A },
        { L"MO",     L"Madrasa",              0x38BDF8 },
        { L"MQ",     L"Misaq",                0x7C3AED },
        { L"MUL",    L"Mulaqaat",             0xEA580C },
        { L"MYN",    L"Miyana",               0xD946EF },
        { L"MZ",     L"Majmui Ziyafat",       0xAF52DE },
        { L"N",      L"Nikah",                0xFFD60A },
        { L"NAMAZ",  L"Namaz",                0xEAB308 },
        { L"ONLINE", L"Online",               0x0EA5E9 },
        { L"Q",      L"Qadam",                0xFF3B30 },
        { L"QMZ",    L"Qadam Majlis Ziyafat", 0xC026D3 },
        { L"SH",     L"Sharaf",               0xFB923C },
        { L"SQ",     L"Shifa Qadam",          0xB91C1C },
        { L"TJR",    L"Tijarat",              0x65A30D },
        { L"TQ",     L"Talaqqi",              0x0D9488 },
        { L"TQN",    L"Tahneeq",              0x7DD3FC },
        { L"WAAZ",   L"Waaz",                 0xFF9500 },
        { L"WD",     L"Wada",                 0x475569 },
        { L"Z",      L"Ziyafat",              0x007AFF },
        { L"ZO",     L"Zafaf Olda",           0xF472B6 }
    };
    return s_events;
}

inline std::wstring GetEventFullName(const std::wstring& code) {
    for (const auto& ev : GetOfficialEvents()) {
        if (code == ev.code) return ev.name;
    }
    return code == L"OTHER" ? L"Other Event" : code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchy & Token Parsing
// ─────────────────────────────────────────────────────────────────────────────
enum class FolderLevel {
    Unknown,
    SafarRoot,    // e.g. "1448-10-Istefada ilmiyah"
    DateSession,  // e.g. "1448-04-18 _01M" or "1448-04-05 _02E"
    ItemEvent     // e.g. "1448-04-18 _01M-01-01Q-20398749" or "1448-04-05 _02E-05-H-"
};

struct ParsedItemInfo {
    std::wstring date;
    std::wstring session;
    std::wstring sessionType;
    std::wstring itemIndex;
    std::wstring occurrence;
    std::wstring eventCode;
    std::wstring eventName;
    std::wstring itsId;
    bool isValid = false;
};

inline ParsedItemInfo ParseItemFolderName(const std::wstring& folderName) {
    ParsedItemInfo info;
    static const std::wregex pattern(
        LR"(^(\d{4}-\d{2}-\d{2})\s*_(\d{2}[MEme])[-_](?:(\d{1,3}[a-zA-Z]?)[-_](.*)|(\d{1,3}[A-Za-z]+.*))$)"
    );

    std::wsmatch match;
    if (std::regex_match(folderName, match, pattern)) {
        info.date = match[1].str();
        info.session = match[2].str();
        std::transform(info.session.begin(), info.session.end(), info.session.begin(), ::towupper);
        info.sessionType = (info.session.find(L'M') != std::wstring::npos) ? L"Morning" : L"Evening";

        std::wstring remainder;
        if (match[5].matched) {
            std::wstring merged = match[5].str();
            static const std::wregex numPat(LR"(^(\d+)(.*)$)");
            std::wsmatch numMatch;
            if (std::regex_match(merged, numMatch, numPat)) {
                info.itemIndex = numMatch[1].str();
                remainder = numMatch[2].str();
            } else {
                info.itemIndex = L"01";
                remainder = merged;
            }
        } else {
            info.itemIndex = match[3].str();
            remainder = match[4].matched ? match[4].str() : L"";
        }

        std::wstring upRemainder = remainder;
        std::transform(upRemainder.begin(), upRemainder.end(), upRemainder.begin(), ::towupper);

        auto events = GetOfficialEvents();
        std::sort(events.begin(), events.end(), [](const EventDefinition& a, const EventDefinition& b) {
            return wcslen(a.code) > wcslen(b.code);
        });

        // 1. Check occurrence + code (e.g. 01Q, 22ZO, 01AQ)
        static const std::wregex occPattern(LR"((\d{1,2})([A-Za-z]+))");
        std::wsmatch occMatch;
        if (std::regex_search(upRemainder, occMatch, occPattern)) {
            info.occurrence = occMatch[0].str();
            std::wstring foundCode = occMatch[2].str();
            for (const auto& ev : events) {
                if (foundCode == ev.code) {
                    info.eventCode = ev.code;
                    info.eventName = ev.name;
                    break;
                }
            }
        }

        // 2. Direct code search with hyphens or boundary
        if (info.eventCode.empty()) {
            for (const auto& ev : events) {
                std::wstring c = ev.code;
                std::wstring wrapped = L"-" + upRemainder + L"-";
                if (wrapped.find(L"-" + c + L"-") != std::wstring::npos ||
                    wrapped.find(L"_" + c + L"_") != std::wstring::npos ||
                    upRemainder.find(c) != std::wstring::npos) {
                    info.eventCode = ev.code;
                    info.eventName = ev.name;
                    break;
                }
            }
        }

        // 3. Extract ITS ID
        static const std::wregex itsPattern(LR"((\d{8}))");
        std::wsmatch itsMatch;
        if (std::regex_search(remainder, itsMatch, itsPattern)) {
            info.itsId = itsMatch[1].str();
        }

        if (info.eventCode.empty()) {
            info.eventCode = L"OTHER";
            info.eventName = L"Other";
        }

        info.isValid = true;
    }
    return info;
}

inline FolderLevel DetectFolderLevel(const std::wstring& folderName) {
    static const std::wregex dateSessionPattern(LR"(^\d{4}-\d{2}-\d{2}\s*_\d{2}[MEme].*$)");
    if (std::regex_match(folderName, dateSessionPattern)) {
        if (ParseItemFolderName(folderName).isValid ||
            folderName.find(L"-01-") != std::wstring::npos ||
            folderName.find(L"-02-") != std::wstring::npos) {
            return FolderLevel::ItemEvent;
        }
        return FolderLevel::DateSession;
    }

    static const std::wregex safarRootPattern(LR"(^14\d{2}[-_]\d{1,2}.*$)");
    if (std::regex_match(folderName, safarRootPattern)) {
        return FolderLevel::SafarRoot;
    }

    return FolderLevel::Unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fast MP4/MOV Binary Duration Reader & Formatter
// ─────────────────────────────────────────────────────────────────────────────
inline double GetVideoDurationSeconds(const std::wstring& filePath) {
    // 1. Try Windows Shell Property Store
    IShellItem2* pItem = nullptr;
    HRESULT hr = SHCreateItemFromParsingName(filePath.c_str(), nullptr, IID_PPV_ARGS(&pItem));
    if (SUCCEEDED(hr) && pItem) {
        PROPVARIANT propvar;
        PropVariantInit(&propvar);
        hr = pItem->GetProperty(PKEY_Media_Duration, &propvar);
        if (SUCCEEDED(hr) && (propvar.vt == VT_UI8)) {
            double secs = static_cast<double>(propvar.uhVal.QuadPart) / 10000000.0;
            PropVariantClear(&propvar);
            pItem->Release();
            if (secs > 0) return secs;
        }
        PropVariantClear(&propvar);
        pItem->Release();
    }

    // 2. Fallback: Fast ISO Base Media File Format (MP4/MOV) atom parser for mvhd box
    std::ifstream file(std::filesystem::path(filePath), std::ios::binary);
    if (!file.is_open()) return 0.0;

    char buffer[8];
    while (file.read(buffer, 8)) {
        unsigned int size = (static_cast<unsigned char>(buffer[0]) << 24) |
                            (static_cast<unsigned char>(buffer[1]) << 16) |
                            (static_cast<unsigned char>(buffer[2]) << 8)  |
                            static_cast<unsigned char>(buffer[3]);
        std::string atom(buffer + 4, 4);

        if (size == 1) {
            char extSize[8];
            if (!file.read(extSize, 8)) break;
            if (atom != "moov") {
                uint64_t fullSize = 0;
                for (int i = 0; i < 8; i++) fullSize = (fullSize << 8) | static_cast<unsigned char>(extSize[i]);
                if (fullSize > 16) file.seekg(fullSize - 16, std::ios::cur);
                continue;
            }
        }

        if (atom == "moov") continue;

        if (atom == "mvhd") {
            char vBuf[4];
            if (!file.read(vBuf, 4)) break;
            int version = static_cast<unsigned char>(vBuf[0]);

            if (version == 1) {
                file.seekg(16, std::ios::cur);
                char tsBuf[4];
                char durBuf[8];
                if (file.read(tsBuf, 4) && file.read(durBuf, 8)) {
                    uint32_t timescale = (static_cast<unsigned char>(tsBuf[0]) << 24) |
                                         (static_cast<unsigned char>(tsBuf[1]) << 16) |
                                         (static_cast<unsigned char>(tsBuf[2]) << 8)  |
                                         static_cast<unsigned char>(tsBuf[3]);
                    uint64_t duration = 0;
                    for (int i = 0; i < 8; i++) duration = (duration << 8) | static_cast<unsigned char>(durBuf[i]);
                    if (timescale > 0) return static_cast<double>(duration) / timescale;
                }
            } else {
                file.seekg(8, std::ios::cur);
                char tsBuf[4];
                char durBuf[4];
                if (file.read(tsBuf, 4) && file.read(durBuf, 4)) {
                    uint32_t timescale = (static_cast<unsigned char>(tsBuf[0]) << 24) |
                                         (static_cast<unsigned char>(tsBuf[1]) << 16) |
                                         (static_cast<unsigned char>(tsBuf[2]) << 8)  |
                                         static_cast<unsigned char>(tsBuf[3]);
                    uint32_t duration = (static_cast<unsigned char>(durBuf[0]) << 24) |
                                        (static_cast<unsigned char>(durBuf[1]) << 16) |
                                        (static_cast<unsigned char>(durBuf[2]) << 8)  |
                                        static_cast<unsigned char>(durBuf[3]);
                    if (timescale > 0) return static_cast<double>(duration) / timescale;
                }
            }
            break;
        }

        if (size > 8) file.seekg(size - 8, std::ios::cur);
        else break;
    }
    return 0.0;
}

inline std::wstring FormatDurationToHHMMSS(double totalSeconds) {
    if (totalSeconds <= 0) return L"0m 00s";
    long long secs = static_cast<long long>(totalSeconds);
    long long hours = secs / 3600;
    long long mins = (secs % 3600) / 60;
    long long remSecs = secs % 60;

    wchar_t buf[64];
    if (hours > 0) {
        swprintf_s(buf, L"%lldh %02lldm %02llds", hours, mins, remSecs);
    } else {
        swprintf_s(buf, L"%lldm %02llds", mins, remSecs);
    }
    return buf;
}

// ─────────────────────────────────────────────────────────────────────────────
// Safar Analysis Model & Recursive Folder Scanner
// ─────────────────────────────────────────────────────────────────────────────
struct SafarAnalysisResult {
    FolderLevel level = FolderLevel::Unknown;
    std::wstring folderPath;
    std::wstring folderName;
    int totalDays = 0;
    int totalEvents = 0;
    int totalVideos = 0;
    double totalDurationSeconds = 0.0;
    uint64_t totalSizeBytes = 0;
    std::map<std::wstring, int> eventCounts; // Non-zero only
    bool showFullNames = false;
};

inline void ScanItemFolderMedia(const std::wstring& itemPath, SafarAnalysisResult& res) {
    WIN32_FIND_DATAW subFind;
    HANDLE hSub = FindFirstFileW((itemPath + L"\\*").c_str(), &subFind);
    if (hSub == INVALID_HANDLE_VALUE) return;

    do {
        if (wcscmp(subFind.cFileName, L".") == 0 || wcscmp(subFind.cFileName, L"..") == 0) continue;

        std::wstring childPath = itemPath + L"\\" + subFind.cFileName;
        if (subFind.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            // Person subfolder or nested clip folder
            ScanItemFolderMedia(childPath, res);
        } else {
            std::wstring ext = PathFindExtensionW(subFind.cFileName);
            std::transform(ext.begin(), ext.end(), ext.begin(), ::towlower);
            if (ext == L".mp4" || ext == L".mov" || ext == L".mkv" || ext == L".m4v") {
                res.totalVideos++;
                res.totalDurationSeconds += GetVideoDurationSeconds(childPath);
            }
            uint64_t fSize = (static_cast<uint64_t>(subFind.nFileSizeHigh) << 32) | subFind.nFileSizeLow;
            res.totalSizeBytes += fSize;
        }
    } while (FindNextFileW(hSub, &subFind));
    FindClose(hSub);
}

inline void AnalyzeSafarFolder(const std::wstring& folderPath, SafarAnalysisResult& res) {
    res.folderPath = folderPath;
    res.folderName = PathFindFileNameW(folderPath.c_str());
    res.level = DetectFolderLevel(res.folderName);
    res.showFullNames = settings.showFullNamesByDefault;

    WIN32_FIND_DATAW findData;
    std::wstring searchPath = folderPath + L"\\*";
    HANDLE hFind = FindFirstFileW(searchPath.c_str(), &findData);
    if (hFind == INVALID_HANDLE_VALUE) return;

    std::vector<std::wstring> subfolders;
    do {
        if (findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            if (wcscmp(findData.cFileName, L".") != 0 && wcscmp(findData.cFileName, L"..") != 0) {
                subfolders.push_back(findData.cFileName);
            }
        } else {
            std::wstring ext = PathFindExtensionW(findData.cFileName);
            std::transform(ext.begin(), ext.end(), ext.begin(), ::towlower);
            if (ext == L".mp4" || ext == L".mov" || ext == L".mkv" || ext == L".m4v") {
                res.totalVideos++;
                std::wstring fullFilePath = folderPath + L"\\" + findData.cFileName;
                res.totalDurationSeconds += GetVideoDurationSeconds(fullFilePath);
            }
            uint64_t fSize = (static_cast<uint64_t>(findData.nFileSizeHigh) << 32) | findData.nFileSizeLow;
            res.totalSizeBytes += fSize;
        }
    } while (FindNextFileW(hFind, &findData));
    FindClose(hFind);

    if (res.level == FolderLevel::SafarRoot) {
        // Level 1: Subfolders are Date Sessions (e.g. 1448-04-18 _01M)
        for (const auto& sub : subfolders) {
            FolderLevel subLevel = DetectFolderLevel(sub);
            if (subLevel == FolderLevel::DateSession) {
                res.totalDays++;
                std::wstring datePath = folderPath + L"\\" + sub;

                WIN32_FIND_DATAW dateFind;
                HANDLE hDate = FindFirstFileW((datePath + L"\\*").c_str(), &dateFind);
                if (hDate != INVALID_HANDLE_VALUE) {
                    do {
                        if ((dateFind.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) &&
                            wcscmp(dateFind.cFileName, L".") != 0 && wcscmp(dateFind.cFileName, L"..") != 0) {
                            
                            std::wstring itemDir = dateFind.cFileName;
                            ParsedItemInfo item = ParseItemFolderName(itemDir);
                            if (item.isValid) {
                                res.totalEvents++;
                                res.eventCounts[item.eventCode]++;
                                ScanItemFolderMedia(datePath + L"\\" + itemDir, res);
                            } else {
                                // Could be an intermediate grouping category (e.g. 01-Surat-QMZ)
                                std::wstring catPath = datePath + L"\\" + itemDir;
                                WIN32_FIND_DATAW catFind;
                                HANDLE hCat = FindFirstFileW((catPath + L"\\*").c_str(), &catFind);
                                if (hCat != INVALID_HANDLE_VALUE) {
                                    do {
                                        if ((catFind.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) &&
                                            wcscmp(catFind.cFileName, L".") != 0 && wcscmp(catFind.cFileName, L"..") != 0) {
                                            ParsedItemInfo catItem = ParseItemFolderName(catFind.cFileName);
                                            if (catItem.isValid) {
                                                res.totalEvents++;
                                                res.eventCounts[catItem.eventCode]++;
                                                ScanItemFolderMedia(catPath + L"\\" + catFind.cFileName, res);
                                            }
                                        }
                                    } while (FindNextFileW(hCat, &catFind));
                                    FindClose(hCat);
                                }
                            }
                        }
                    } while (FindNextFileW(hDate, &dateFind));
                    FindClose(hDate);
                }
            }
        }
    } else if (res.level == FolderLevel::DateSession) {
        // Level 2: Target folder itself is a Date Session
        res.totalDays = 1;
        for (const auto& sub : subfolders) {
            ParsedItemInfo item = ParseItemFolderName(sub);
            if (item.isValid) {
                res.totalEvents++;
                res.eventCounts[item.eventCode]++;
                ScanItemFolderMedia(folderPath + L"\\" + sub, res);
            } else {
                // Check category subfolder
                std::wstring catPath = folderPath + L"\\" + sub;
                WIN32_FIND_DATAW catFind;
                HANDLE hCat = FindFirstFileW((catPath + L"\\*").c_str(), &catFind);
                if (hCat != INVALID_HANDLE_VALUE) {
                    do {
                        if ((catFind.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) &&
                            wcscmp(catFind.cFileName, L".") != 0 && wcscmp(catFind.cFileName, L"..") != 0) {
                            ParsedItemInfo catItem = ParseItemFolderName(catFind.cFileName);
                            if (catItem.isValid) {
                                res.totalEvents++;
                                res.eventCounts[catItem.eventCode]++;
                                ScanItemFolderMedia(catPath + L"\\" + catFind.cFileName, res);
                            }
                        }
                    } while (FindNextFileW(hCat, &catFind));
                    FindClose(hCat);
                }
            }
        }
    } else if (res.level == FolderLevel::ItemEvent) {
        // Level 3: Target folder is a single Event Item
        ParsedItemInfo item = ParseItemFolderName(res.folderName);
        if (item.isValid) {
            res.totalEvents = 1;
            res.eventCounts[item.eventCode] = 1;
        }
        ScanItemFolderMedia(folderPath, res);
    } else {
        // General folder: Check if items exist inside
        for (const auto& sub : subfolders) {
            ParsedItemInfo item = ParseItemFolderName(sub);
            if (item.isValid) {
                res.totalEvents++;
                res.eventCounts[item.eventCode]++;
                ScanItemFolderMedia(folderPath + L"\\" + sub, res);
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic UI Controls & ListView Population
// ─────────────────────────────────────────────────────────────────────────────
inline void PopulateEventsListView(HWND hListView, const SafarAnalysisResult& res) {
    ListView_DeleteAllItems(hListView);

    int idx = 0;
    int totalEv = res.totalEvents > 0 ? res.totalEvents : 1;
    for (const auto& pair : res.eventCounts) {
        if (pair.second <= 0) continue; // Zero-count suppression!

        LVITEMW lvi = { 0 };
        lvi.mask = LVIF_TEXT;
        lvi.iItem = idx;
        lvi.iSubItem = 0;

        std::wstring displayLabel = res.showFullNames ? GetEventFullName(pair.first) : pair.first;
        lvi.pszText = const_cast<LPWSTR>(displayLabel.c_str());
        ListView_InsertItem(hListView, &lvi);

        // SubItem 1: Count
        wchar_t countBuf[32];
        swprintf_s(countBuf, L"%d event%s", pair.second, pair.second > 1 ? L"s" : L"");
        ListView_SetItemText(hListView, idx, 1, countBuf);

        // SubItem 2: Official Name or Abbr
        std::wstring altLabel = res.showFullNames ? pair.first : GetEventFullName(pair.first);
        ListView_SetItemText(hListView, idx, 2, const_cast<LPWSTR>(altLabel.c_str()));

        // SubItem 3: Share Percentage
        wchar_t shareBuf[32];
        double pct = (static_cast<double>(pair.second) / totalEv) * 100.0;
        swprintf_s(shareBuf, L"%.1f%%", pct);
        ListView_SetItemText(hListView, idx, 3, shareBuf);

        idx++;
    }
}

inline HFONT GetSegoeFont(int pointSize, bool bold = false) {
    HDC hdc = GetDC(NULL);
    int nHeight = -MulDiv(pointSize, GetDeviceCaps(hdc, LOGPIXELSY), 72);
    ReleaseDC(NULL, hdc);
    return CreateFontW(nHeight, 0, 0, 0, bold ? FW_BOLD : FW_NORMAL, FALSE, FALSE, FALSE,
                       DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                       CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog Procedure for Property Sheet Page & Standalone Dialog
// ─────────────────────────────────────────────────────────────────────────────
INT_PTR CALLBACK SafarInspectorDlgProc(HWND hDlg, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    SafarAnalysisResult* pData = reinterpret_cast<SafarAnalysisResult*>(GetWindowLongPtrW(hDlg, DWLP_USER));

    switch (uMsg) {
    case WM_INITDIALOG: {
        PROPSHEETPAGEW* pPage = reinterpret_cast<PROPSHEETPAGEW*>(lParam);
        if (pPage && pPage->lParam) {
            pData = reinterpret_cast<SafarAnalysisResult*>(pPage->lParam);
        } else if (lParam) {
            pData = reinterpret_cast<SafarAnalysisResult*>(lParam);
        }
        SetWindowLongPtrW(hDlg, DWLP_USER, reinterpret_cast<LONG_PTR>(pData));
        if (!pData) return TRUE;

        HFONT hFontTitle = GetSegoeFont(12, true);
        HFONT hFontRegular = GetSegoeFont(9, false);
        HFONT hFontBold = GetSegoeFont(9, true);

        // 1. Create Header & Badges
        HWND hTitle = CreateWindowExW(0, L"STATIC", pData->folderName.c_str(),
            WS_CHILD | WS_VISIBLE | SS_LEFT, 16, 12, 330, 24, hDlg, (HMENU)IDC_SAFAR_TITLE, NULL, NULL);
        SendMessageW(hTitle, WM_SETFONT, (WPARAM)hFontTitle, TRUE);

        std::wstring levelStr = L"Level: General Directory";
        if (pData->level == FolderLevel::SafarRoot) levelStr = L"📁 Level 1: Main Safar Root Folder";
        else if (pData->level == FolderLevel::DateSession) levelStr = L"📅 Level 2: Date Session Folder (Day)";
        else if (pData->level == FolderLevel::ItemEvent) levelStr = L"🎯 Level 3: Individual Event Item Folder";
        
        HWND hLevel = CreateWindowExW(0, L"STATIC", levelStr.c_str(),
            WS_CHILD | WS_VISIBLE | SS_LEFT, 16, 38, 330, 18, hDlg, (HMENU)IDC_SAFAR_LEVEL, NULL, NULL);
        SendMessageW(hLevel, WM_SETFONT, (WPARAM)hFontBold, TRUE);

        // 2. Metrics Cards
        wchar_t daysBuf[64];
        swprintf_s(daysBuf, L"📅 Days in Safar: %d day%s", pData->totalDays, pData->totalDays != 1 ? L"s" : L"");
        HWND hDays = CreateWindowExW(0, L"STATIC", daysBuf,
            WS_CHILD | WS_VISIBLE | SS_LEFT, 16, 62, 330, 18, hDlg, (HMENU)IDC_SAFAR_DAYS, NULL, NULL);
        SendMessageW(hDays, WM_SETFONT, (WPARAM)hFontRegular, TRUE);

        wchar_t eventsBuf[64];
        swprintf_s(eventsBuf, L"🎯 Total Events: %d recorded", pData->totalEvents);
        HWND hEvents = CreateWindowExW(0, L"STATIC", eventsBuf,
            WS_CHILD | WS_VISIBLE | SS_LEFT, 16, 82, 330, 18, hDlg, (HMENU)IDC_SAFAR_EVENTS, NULL, NULL);
        SendMessageW(hEvents, WM_SETFONT, (WPARAM)hFontRegular, TRUE);

        wchar_t timelineBuf[128];
        std::wstring durFormatted = FormatDurationToHHMMSS(pData->totalDurationSeconds);
        swprintf_s(timelineBuf, L"🎬 Premiere Pro Timeline: %s (%d clips)", durFormatted.c_str(), pData->totalVideos);
        HWND hTimeline = CreateWindowExW(0, L"STATIC", timelineBuf,
            WS_CHILD | WS_VISIBLE | SS_LEFT, 16, 102, 330, 18, hDlg, (HMENU)IDC_SAFAR_TIMELINE, NULL, NULL);
        SendMessageW(hTimeline, WM_SETFONT, (WPARAM)hFontRegular, TRUE);

        // 3. SysListView32 for Non-Zero Events
        HWND hListView = CreateWindowExW(WS_EX_CLIENTEDGE, WC_LISTVIEWW, L"",
            WS_CHILD | WS_VISIBLE | LVS_REPORT | LVS_SINGLESEL,
            16, 126, 330, 190, hDlg, (HMENU)IDC_SAFAR_LISTVIEW, NULL, NULL);
        SendMessageW(hListView, WM_SETFONT, (WPARAM)hFontRegular, TRUE);
        ListView_SetExtendedListViewStyle(hListView, LVS_EX_FULLROWSELECT | LVS_EX_GRIDLINES | LVS_EX_DOUBLEBUFFER);

        LVCOLUMNW col = { 0 };
        col.mask = LVCF_TEXT | LVCF_WIDTH | LVCF_SUBITEM;
        col.cx = 85;
        col.pszText = const_cast<LPWSTR>(L"Code");
        ListView_InsertColumn(hListView, 0, &col);

        col.cx = 75;
        col.pszText = const_cast<LPWSTR>(L"Count");
        ListView_InsertColumn(hListView, 1, &col);

        col.cx = 120;
        col.pszText = const_cast<LPWSTR>(L"Official Name");
        ListView_InsertColumn(hListView, 2, &col);

        col.cx = 50;
        col.pszText = const_cast<LPWSTR>(L"Share");
        ListView_InsertColumn(hListView, 3, &col);

        PopulateEventsListView(hListView, *pData);

        // 4. Action Buttons
        HWND hBtnToggle = CreateWindowExW(0, L"BUTTON", 
            pData->showFullNames ? L"Show Abbr" : L"Full Names",
            WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
            16, 324, 95, 26, hDlg, (HMENU)IDC_BTN_TOGGLE_NAMES, NULL, NULL);
        SendMessageW(hBtnToggle, WM_SETFONT, (WPARAM)hFontRegular, TRUE);

        HWND hBtnCopy = CreateWindowExW(0, L"BUTTON", L"📋 Copy Report",
            WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
            117, 324, 110, 26, hDlg, (HMENU)IDC_BTN_COPY_SUMMARY, NULL, NULL);
        SendMessageW(hBtnCopy, WM_SETFONT, (WPARAM)hFontRegular, TRUE);

        HWND hBtnGui = CreateWindowExW(0, L"BUTTON", L"🚀 Studio GUI",
            WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
            233, 324, 113, 26, hDlg, (HMENU)IDC_BTN_OPEN_GUI, NULL, NULL);
        SendMessageW(hBtnGui, WM_SETFONT, (WPARAM)hFontRegular, TRUE);

        return TRUE;
    }

    case WM_COMMAND: {
        WORD id = LOWORD(wParam);
        if (id == IDC_BTN_TOGGLE_NAMES && pData) {
            pData->showFullNames = !pData->showFullNames;
            SetDlgItemTextW(hDlg, IDC_BTN_TOGGLE_NAMES, pData->showFullNames ? L"Show Abbr" : L"Full Names");
            HWND hListView = GetDlgItem(hDlg, IDC_SAFAR_LISTVIEW);
            PopulateEventsListView(hListView, *pData);
            return TRUE;
        }
        else if (id == IDC_BTN_COPY_SUMMARY && pData) {
            std::wstringstream ss;
            ss << L"🏕️ *" << pData->folderName << L"*\n";
            ss << L"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
            ss << L"📅 Total Days: " << pData->totalDays << L" days\n";
            ss << L"🎯 Total Events: " << pData->totalEvents << L" events\n";
            ss << L"🎬 Premiere Pro Timeline: " << FormatDurationToHHMMSS(pData->totalDurationSeconds) 
               << L" (" << pData->totalVideos << L" video clips)\n";
            double gb = static_cast<double>(pData->totalSizeBytes) / (1024.0 * 1024.0 * 1024.0);
            ss << L"📦 Total Media Size: " << std::fixed << std::setprecision(2) << gb << L" GB\n\n";
            ss << L"*📊 Event Segregation Breakdown:*\n";
            for (const auto& p : pData->eventCounts) {
                if (p.second > 0) {
                    ss << L"• *" << p.first << L"* (" << GetEventFullName(p.first) << L"): " << p.second << L"\n";
                }
            }
            std::wstring report = ss.str();

            if (OpenClipboard(hDlg)) {
                EmptyClipboard();
                size_t bytes = (report.size() + 1) * sizeof(wchar_t);
                HGLOBAL hMem = GlobalAlloc(GMEM_MOVEABLE, bytes);
                if (hMem) {
                    memcpy(GlobalLock(hMem), report.c_str(), bytes);
                    GlobalUnlock(hMem);
                    SetClipboardData(CF_UNICODETEXT, hMem);
                }
                CloseClipboard();
                MessageBoxW(hDlg, L"Safar Executive Summary copied to clipboard!", L"Copied ✅", MB_OK | MB_ICONINFORMATION);
            }
            return TRUE;
        }
        else if (id == IDC_BTN_OPEN_GUI && pData) {
            std::wstring cmd = L"pythonw.exe \"" + settings.pythonGuiPath + L"\" \"" + pData->folderPath + L"\"";
            STARTUPINFOW si = { sizeof(STARTUPINFOW) };
            PROCESS_INFORMATION pi = { 0 };
            std::vector<wchar_t> cmdBuf(cmd.begin(), cmd.end());
            cmdBuf.push_back(0);
            if (CreateProcessW(NULL, cmdBuf.data(), NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
                CloseHandle(pi.hProcess);
                CloseHandle(pi.hThread);
            } else {
                // Try python.exe if pythonw not available
                cmd = L"python.exe \"" + settings.pythonGuiPath + L"\" \"" + pData->folderPath + L"\"";
                std::vector<wchar_t> cmdBuf2(cmd.begin(), cmd.end());
                cmdBuf2.push_back(0);
                CreateProcessW(NULL, cmdBuf2.data(), NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi);
            }
            return TRUE;
        }
        else if (id == IDCANCEL) {
            EndDialog(hDlg, IDCANCEL);
            return TRUE;
        }
        break;
    }

    case WM_DESTROY: {
        HFONT hTitleFont = (HFONT)SendMessageW(GetDlgItem(hDlg, IDC_SAFAR_TITLE), WM_GETFONT, 0, 0);
        if (hTitleFont) DeleteObject(hTitleFont);
        break;
    }
    }
    return FALSE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property Sheet Page & Standalone Dialog Creators
// ─────────────────────────────────────────────────────────────────────────────
#pragma pack(push, 2)
struct DLGTEMPLATE_INDIRECT {
    DWORD style;
    DWORD dwExtendedStyle;
    WORD cdit;
    short x;
    short y;
    short cx;
    short cy;
    WORD menu;
    WORD windowClass;
    WCHAR title[1];
};
#pragma pack(pop)

inline HPROPSHEETPAGE CreateSafarPropertySheetPage(const std::wstring& targetFolder) {
    static DLGTEMPLATE_INDIRECT s_tmpl = { 0 };
    s_tmpl.style = WS_CHILD | WS_VISIBLE | DS_CONTROL | DS_SHELLFONT;
    s_tmpl.cx = 250;
    s_tmpl.cy = 280;

    SafarAnalysisResult* pRes = new SafarAnalysisResult();
    AnalyzeSafarFolder(targetFolder, *pRes);

    PROPSHEETPAGEW psp = { sizeof(PROPSHEETPAGEW) };
    psp.dwFlags = PSP_DLGINDIRECT | PSP_USETITLE;
    psp.pResource = reinterpret_cast<LPCDLGTEMPLATE>(&s_tmpl);
    psp.pszTitle = L"🏕️ Safar & Media Stats";
    psp.pfnDlgProc = SafarInspectorDlgProc;
    psp.lParam = reinterpret_cast<LPARAM>(pRes);

    return CreatePropertySheetPageW(&psp);
}

inline void ShowSafarInspectorStandaloneDialog(HWND hWndParent, const std::wstring& folderPath) {
    DLGTEMPLATE_INDIRECT tmpl = { 0 };
    tmpl.style = WS_POPUP | WS_CAPTION | WS_SYSMENU | WS_VISIBLE | DS_MODALFRAME | DS_CENTER;
    tmpl.cx = 250;
    tmpl.cy = 280;

    SafarAnalysisResult res;
    AnalyzeSafarFolder(folderPath, res);

    DialogBoxIndirectParamW(
        GetModuleHandle(NULL),
        reinterpret_cast<LPCDLGTEMPLATE>(&tmpl),
        hWndParent,
        SafarInspectorDlgProc,
        reinterpret_cast<LPARAM>(&res)
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Explorer Active/Selected Folder Resolution via Shell COM
// ─────────────────────────────────────────────────────────────────────────────
inline std::wstring GetExplorerActiveOrSelectedPath() {
    std::wstring result;
    IShellWindows* psw = nullptr;
    HRESULT hr = CoCreateInstance(CLSID_ShellWindows, NULL, CLSCTX_ALL, IID_IShellWindows, (void**)&psw);
    if (SUCCEEDED(hr) && psw) {
        long count = 0;
        psw->get_Count(&count);
        for (long i = 0; i < count; i++) {
            VARIANT v;
            VariantInit(&v);
            v.vt = VT_I4;
            v.lVal = i;
            IDispatch* pDisp = nullptr;
            if (SUCCEEDED(psw->Item(v, &pDisp)) && pDisp) {
                IWebBrowserApp* pApp = nullptr;
                if (SUCCEEDED(pDisp->QueryInterface(IID_IWebBrowserApp, (void**)&pApp)) && pApp) {
                    IServiceProvider* psp = nullptr;
                    if (SUCCEEDED(pApp->QueryInterface(IID_IServiceProvider, (void**)&psp)) && psp) {
                        IShellBrowser* psb = nullptr;
                        if (SUCCEEDED(psp->QueryService(SID_STopLevelBrowser, IID_IShellBrowser, (void**)&psb)) && psb) {
                            IShellView* psv = nullptr;
                            if (SUCCEEDED(psb->QueryActiveShellView(&psv)) && psv) {
                                IFolderView* pfv = nullptr;
                                if (SUCCEEDED(psv->QueryInterface(IID_IFolderView, (void**)&pfv)) && pfv) {
                                    int selCount = 0;
                                    pfv->ItemCount(SVGIO_SELECTION, &selCount);
                                    if (selCount > 0) {
                                        ITEMIDLIST* pidl = nullptr;
                                        if (SUCCEEDED(pfv->Item(0, &pidl)) && pidl) {
                                            wchar_t buf[MAX_PATH];
                                            if (SHGetPathFromIDListW(pidl, buf)) {
                                                result = buf;
                                            }
                                            CoTaskMemFree(pidl);
                                        }
                                    }
                                    if (result.empty()) {
                                        IPersistFolder2* ppf2 = nullptr;
                                        if (SUCCEEDED(pfv->GetFolder(IID_IPersistFolder2, (void**)&ppf2)) && ppf2) {
                                            ITEMIDLIST* pidl = nullptr;
                                            if (SUCCEEDED(ppf2->GetCurFolder(&pidl)) && pidl) {
                                                wchar_t buf[MAX_PATH];
                                                if (SHGetPathFromIDListW(pidl, buf)) {
                                                    result = buf;
                                                }
                                                CoTaskMemFree(pidl);
                                            }
                                            ppf2->Release();
                                        }
                                    }
                                    pfv->Release();
                                }
                                psv->Release();
                            }
                            psb->Release();
                        }
                        psp->Release();
                    }
                    pApp->Release();
                }
                pDisp->Release();
            }
            if (!result.empty()) break;
        }
        psw->Release();
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Function Hooks: PropertySheetW & TrackPopupMenuEx
// ─────────────────────────────────────────────────────────────────────────────
using PropertySheetW_t = decltype(&PropertySheetW);
PropertySheetW_t PropertySheetW_Original;

INT_PTR WINAPI PropertySheetW_Hook(LPCPROPSHEETHEADERW lppsph) {
    if (!lppsph) return PropertySheetW_Original(lppsph);

    std::wstring targetFolder = GetExplorerActiveOrSelectedPath();
    if (!targetFolder.empty() && PathIsDirectoryW(targetFolder.c_str())) {
        HPROPSHEETPAGE hPage = CreateSafarPropertySheetPage(targetFolder);
        if (hPage) {
            if (!(lppsph->dwFlags & PSH_PROPSHEETPAGE)) {
                UINT newCount = lppsph->nPages + 1;
                HPROPSHEETPAGE* pNewPages = reinterpret_cast<HPROPSHEETPAGE*>(LocalAlloc(LPTR, sizeof(HPROPSHEETPAGE) * newCount));
                if (pNewPages) {
                    for (UINT i = 0; i < lppsph->nPages; i++) {
                        pNewPages[i] = lppsph->phpage[i];
                    }
                    pNewPages[lppsph->nPages] = hPage;

                    PROPSHEETHEADERW newHdr = *lppsph;
                    newHdr.phpage = pNewPages;
                    newHdr.nPages = newCount;

                    INT_PTR res = PropertySheetW_Original(&newHdr);
                    LocalFree(pNewPages);
                    return res;
                }
            }
        }
    }
    return PropertySheetW_Original(lppsph);
}

using TrackPopupMenuEx_t = decltype(&TrackPopupMenuEx);
TrackPopupMenuEx_t TrackPopupMenuEx_Original;

BOOL WINAPI TrackPopupMenuEx_Hook(HMENU hMenu, UINT uFlags, int x, int y, HWND hWnd, LPTPMPARAMS lptpm) {
    if (settings.enableContextMenu && hMenu) {
        MENUITEMINFOW mii = { sizeof(MENUITEMINFOW) };
        mii.fMask = MIIM_ID | MIIM_STRING;
        mii.wID = IDM_SAFAR_INSPECT;
        mii.dwTypeData = const_cast<LPWSTR>(L"🏕️ Inspect Safar & Media Stats");
        InsertMenuItemW(hMenu, 0, TRUE, &mii);

        MENUITEMINFOW sep = { sizeof(MENUITEMINFOW) };
        sep.fMask = MIIM_FTYPE;
        sep.fType = MFT_SEPARATOR;
        InsertMenuItemW(hMenu, 1, TRUE, &sep);
    }

    if (uFlags & TPM_RETURNCMD) {
        int cmd = TrackPopupMenuEx_Original(hMenu, uFlags, x, y, hWnd, lptpm);
        if (cmd == IDM_SAFAR_INSPECT) {
            std::wstring path = GetExplorerActiveOrSelectedPath();
            if (!path.empty()) {
                ShowSafarInspectorStandaloneDialog(hWnd, path);
            }
            return 0;
        }
        return cmd;
    }

    return TrackPopupMenuEx_Original(hMenu, uFlags, x, y, hWnd, lptpm);
}

// ─────────────────────────────────────────────────────────────────────────────
// Windhawk Module Lifecycle
// ─────────────────────────────────────────────────────────────────────────────
BOOL Wh_ModInit() {
    Wh_Log(L"Safar Folder Inspector Mod v2.0 initializing...");
    LoadSettings();

    // Hook 1: Explorer Property Sheet
    WindhawkUtils::SetFunctionHook(PropertySheetW, PropertySheetW_Hook, &PropertySheetW_Original);

    // Hook 2: Explorer Right-Click Context Menu
    WindhawkUtils::SetFunctionHook(TrackPopupMenuEx, TrackPopupMenuEx_Hook, &TrackPopupMenuEx_Original);

    Wh_Log(L"Safar Folder Inspector Mod initialized successfully.");
    return TRUE;
}

void Wh_ModSettingsChanged() {
    Wh_Log(L"Safar Folder Inspector settings changed.");
    LoadSettings();
}

void Wh_ModUninit() {
    Wh_Log(L"Safar Folder Inspector Mod uninitialized.");
}
