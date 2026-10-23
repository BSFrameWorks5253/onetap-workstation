#pragma once

#include <string>
#include <unordered_map>
#include <vector>

// 34 Official Events from Event List.xlsx
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

inline const wchar_t* GetEventFullName(const std::wstring& code) {
    for (const auto& ev : GetOfficialEvents()) {
        if (code == ev.code) {
            return ev.name;
        }
    }
    return code.c_str();
}
