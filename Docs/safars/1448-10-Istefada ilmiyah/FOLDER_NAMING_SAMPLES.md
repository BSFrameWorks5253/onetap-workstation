# Folder Naming Convention & Prefix Samples Guide

This reference defines the exact folder naming structure for every event prefix (such as **Q**, **N**, **Z**, **M**, **ZO**, **MZ**, **H**, **MF**, **AQ**) based on verified real-world samples taken directly from:
- `E:\In Process\1448-10-Istefada ilmiyah\1448-04-05 _02E\01-Dummas-Bethak`
- `E:\In Process\1448-10-Istefada ilmiyah\1448-04-18 _01M\01-Surat-QMZ`

---

## 1. Syntax Breakdown Template

```text
[Date_Session]-[ItemNumber]-[Occurrence][PREFIX]-[ITS_ID]
      │              │           │        │        │
      │              │           │        │        └── 8-digit ITS number (or empty for non-ITS)
      │              │           │        └────────── Event Prefix Code (e.g. Q, N, Z, M, ZO, MZ)
      │              │           └─────────────────── Sequential occurrence count of this event in session
      │              └─────────────────────────────── Overall session item sequence number (01, 02, ...)
      └────────────────────────────────────────────── Canonical Session ID (YYYY-MM-DD _SS[M|E])
```

Inside each populated item directory is the **Person Name Directory**, which directly holds the raw media clips:
```text
[Item Folder]\
└── [Person Full Name]\
    ├── C0001.MP4
    ├── C0002.MP4
    └── ...
```

---

## 2. One Prefix = One Verified Real Sample

| Prefix | Event Name | Verified Sample Folder Name | Person Subfolder Name | Source Category & Session |
|:---:|:---|:---|:---|:---|
| **`Q`** | **Qadam** | `1448-04-18 _01M-01-01Q-20398749` | `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath` | `1448-04-18 _01M\01-Surat-QMZ` |
| **`N`** | **Nikah** | `1448-04-05 _02E-16-01N-50473950` | `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath` | `1448-04-05 _02E\01-Dummas-Bethak` |
| **`Z`** | **Ziyafat** | `1448-04-18 _01M-04-04Z-50459420` | `Mohammed bhai Huzaifa bhai Matarwala` | `1448-04-18 _01M\01-Surat-QMZ` |
| **`M`** | **Majlis** | `1448-04-18 _01M-06-06M-20352229` | `Mohammed bhai Huzaifa bhai Matarwala` | `1448-04-18 _01M\01-Surat-QMZ` |
| **`ZO`** | **Zafaf Olda** | `1448-04-05 _02E-03-22ZO-30444199` | `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath` | `1448-04-05 _02E\01-Dummas-Bethak` |
| **`MZ`** | **Majmui Ziyafat** | `1448-04-05 _02E-21-09MZ-20361245` | `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath` | `1448-04-05 _02E\01-Dummas-Bethak` |
| **`H`** | **Hadiyah** | `1448-04-05 _02E-05-H-` | *(General - No Person Subfolder)* | `1448-04-05 _02E\01-Dummas-Bethak` |
| **`MF`** | **Mafsuhiyat** | `1448-04-05 _02E-15-MF-` | *(General - No Person Subfolder)* | `1448-04-05 _02E\01-Dummas-Bethak` |
| **`Namaz`** | **Namaz** | `1448-04-05 _02E-50-Namaz-` | *(General - No Person Subfolder)* | `1448-04-05 _02E\01-Dummas-Bethak` |
| **`OT`** | **Other** | `1448-04-05 _02E-81-OT-` | `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath` | `1448-04-05 _02E\01-Dummas-Bethak` |
| **`AQ`** | **Aqueeqah** | `1448-04-10 _01M-01-01AQ-30453043` | `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath` | `1448-04-10 _01M\01-Dummas-Bethak` |

---

## 3. Deep Dive: Token Anatomy per Prefix

### 3.1 Prefix `Q` (Qadam)
- **Sample**: `1448-04-18 _01M-01-01Q-20398749`
- **Session**: `1448-04-18 _01M` (Session 01 Morning)
- **Item Index**: `01`
- **Occurrence**: `01Q` (1st Qadam in this session)
- **ITS ID**: `20398749`
- **Subfolder**: `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath\`
- **Clips**: `C0146.MP4`, `C0147.MP4`, `C0148.MP4`
- **Render Output**: `Final\1448-04-18 _01M\1448-04-18 _01M-01-01Q-20398749.mp4`

### 3.2 Prefix `N` (Nikah)
- **Sample**: `1448-04-05 _02E-16-01N-50473950`
- **Session**: `1448-04-05 _02E` (Session 02 Evening)
- **Item Index**: `16`
- **Occurrence**: `01N` (1st Nikah in this session)
- **ITS ID**: `50473950`
- **Subfolder**: `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath\`
- **Clips**: `C0017.MP4`, `C0018.MP4`, `C0019.MP4`
- **Render Output**: `Final\1448-04-05 _02E\1448-04-05 _02E-16-01N-50473950.mp4`

### 3.3 Prefix `Z` (Ziyafat)
- **Sample**: `1448-04-18 _01M-04-04Z-50459420`
- **Session**: `1448-04-18 _01M` (Session 01 Morning)
- **Item Index**: `04`
- **Occurrence**: `04Z` (4th Ziyafat in this session)
- **ITS ID**: `50459420`
- **Subfolder**: `Mohammed bhai Huzaifa bhai Matarwala\`
- **Clips**: `C0335.MP4`, `C0336.MP4`, `C0337.MP4`
- **Render Output**: `Final\1448-04-18 _01M\1448-04-18 _01M-04-04Z-50459420.mp4`

### 3.4 Prefix `M` (Majlis)
- **Sample**: `1448-04-18 _01M-06-06M-20352229`
- **Session**: `1448-04-18 _01M` (Session 01 Morning)
- **Item Index**: `06`
- **Occurrence**: `06M` (6th Majlis in this session)
- **ITS ID**: `20352229`
- **Subfolder**: `Mohammed bhai Huzaifa bhai Matarwala\`
- **Clips**: `C0353.MP4`, `C0354.MP4`, `C0355.MP4`
- **Render Output**: `Final\1448-04-18 _01M\1448-04-18 _01M-06-06M-20352229.mp4`

### 3.5 Prefix `ZO` (Zafaf Olda)
- **Sample**: `1448-04-05 _02E-03-22ZO-30444199`
- **Session**: `1448-04-05 _02E` (Session 02 Evening)
- **Item Index**: `03`
- **Occurrence**: `22ZO` (22nd Zafaf in this session)
- **ITS ID**: `30444199`
- **Subfolder**: `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath\`
- **Clips**: `C0001.MP4`, `C0002.MP4`, `C0003.MP4`
- **Render Output**: `Final\1448-04-05 _02E\1448-04-05 _02E-03-22ZO-30444199.mp4`

### 3.6 Prefix `MZ` (Majmui Ziyafat)
- **Sample**: `1448-04-05 _02E-21-09MZ-20361245`
- **Session**: `1448-04-05 _02E` (Session 02 Evening)
- **Item Index**: `21`
- **Occurrence**: `09MZ` (9th Majmui Ziyafat in this session)
- **ITS ID**: `20361245`
- **Subfolder**: `Mulla Murtaza bhai Shaikh Juzer bhai Sounasath\`
- **Clips**: `C0031.MP4`, `C0032.MP4`, `C0033.MP4`
- **Render Output**: `Final\1448-04-05 _02E\1448-04-05 _02E-21-09MZ-20361245.mp4`

### 3.7 Non-ITS Event Items (`H`, `MF`, `Namaz`)
For general session events without individual ITS registrants:
- **`H` (Hadiyah)**: `1448-04-05 _02E-05-H-` (ends with trailing dash `-`, no ITS digits)
- **`MF` (Mafsuhiyat)**: `1448-04-05 _02E-15-MF-` (ends with trailing dash `-`, no ITS digits)
- **`Namaz` (Namaz)**: `1448-04-05 _02E-50-Namaz-` (ends with trailing dash `-`, no ITS digits)

---

## 4. Regular Expression for Parsers & Task Tracker

To parse any item folder matching this structure, use:

```regex
^(\d{4}-\d{2}-\d{2}\s+_\d{2}[ME])-(\d{1,3}[a-z]?)-(?:(\d{1,3})?([A-Za-z]+))-(?:(\d{5,8}))?$
```

### Match Groups:
- **Group 1**: Session ID (e.g. `1448-04-18 _01M`)
- **Group 2**: Item Index (e.g. `01`, `04a`, `16`)
- **Group 3**: Occurrence Number (e.g. `01`, `04`, `22` - optional)
- **Group 4**: Prefix Code (e.g. `Q`, `N`, `Z`, `M`, `ZO`, `MZ`, `H`, `MF`)
- **Group 5**: ITS ID (e.g. `20398749` - optional)
