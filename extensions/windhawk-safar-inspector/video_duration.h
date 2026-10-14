#pragma once

#include <windows.h>
#include <propsys.h>
#include <propkey.h>
#include <shlobj.h>
#include <string>
#include <fstream>
#include <vector>

#pragma comment(lib, "propsys.lib")

// Reads media duration in seconds
inline double GetVideoDurationSeconds(const std::wstring& filePath) {
    // Method 1: Use Windows Shell Property Store (PKEY_Media_Duration)
    // Duration is in 100-nanosecond units (10,000,000 units = 1 second)
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

    // Method 2: Fast ISO Base Media File Format (MP4/MOV) atom parser for mvhd box
    std::ifstream file(std::filesystem::path(filePath), std::ios::binary);
    if (!file.is_open()) return 0.0;

    char buffer[8];
    while (file.read(buffer, 8)) {
        unsigned int size = (static_cast<unsigned char>(buffer[0]) << 24) |
                            (static_cast<unsigned char>(buffer[1]) << 16) |
                            (static_cast<unsigned char>(buffer[2]) << 8)  |
                            static_cast<unsigned char>(buffer[3]);

        std::string atom(buffer + 4, 4);

        if (size == 1) { // 64-bit size
            char extSize[8];
            if (!file.read(extSize, 8)) break;
            // Seek past large atom if not moov
            if (atom != "moov") {
                uint64_t fullSize = 0;
                for (int i = 0; i < 8; i++) fullSize = (fullSize << 8) | static_cast<unsigned char>(extSize[i]);
                if (fullSize > 16) file.seekg(fullSize - 16, std::ios::cur);
                continue;
            }
        }

        if (atom == "moov") {
            // Recurse into moov
            continue;
        }

        if (atom == "mvhd") {
            // Read mvhd header (version + flags)
            char vBuf[4];
            if (!file.read(vBuf, 4)) break;
            int version = static_cast<unsigned char>(vBuf[0]);

            if (version == 1) {
                // 64-bit creation, modification, 32-bit timescale, 64-bit duration
                file.seekg(16, std::ios::cur); // skip creation & mod times
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
                // 32-bit creation, mod, timescale, duration
                file.seekg(8, std::ios::cur); // skip creation & mod times
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

        // Skip other atoms
        if (size > 8) {
            file.seekg(size - 8, std::ios::cur);
        } else {
            break;
        }
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
