#pragma once

#include <string>
#include <vector>
#include <regex>
#include <algorithm>
#include "events_definition.h"

enum class FolderLevel {
    Unknown,
    SafarRoot,    // e.g. "1448-10-Istefada ilmiyah" or "1447-08 Mumbai - Urs Mubarak"
    DateSession,  // e.g. "1448-03-13 _01M" or "1448-04-05 _02E"
    ItemEvent     // e.g. "1448-03-13 _01M-02-01N-30338708" or "1448-02-29 _01M-01-N-"
};

struct ParsedItemInfo {
    std::wstring date;          // "1448-03-13"
    std::wstring session;       // "01M" or "02E"
    std::wstring sessionType;   // "Morning" or "Evening"
    std::wstring itemIndex;     // "02" or "01"
    std::wstring occurrence;    // "01N" or ""
    std::wstring eventCode;     // "N", "AQ", "Z", etc.
    std::wstring eventName;     // "Nikah", "Aqiqa", etc.
    std::wstring itsId;         // "30338708" or ""
    bool isValid = false;
};

// Extracts event code from an item folder name
inline ParsedItemInfo ParseItemFolderName(const std::wstring& folderName) {
    ParsedItemInfo info;

    // Pattern examples:
    // 1448-03-13 _01M-02-01N-30338708
    // 1448-02-29 _01M-01-N-
    // 1448-03-13 _01M-02-01AQ-30338708
    // 1448-03-13 _01M-01AQ-
    // 1448-02-29 _01M-01-Z-

    // Regex to capture Date, Session, and either separated item index or merged occurrence
    static const std::wregex pattern(
        LR"(^(\d{4}-\d{2}-\d{2})\s*_(\d{2}[MEme])[-_](?:(\d{1,3})[-_](.*)|(\d{1,3}[A-Za-z]+.*))$)"
    );

    std::wsmatch match;
    if (std::regex_match(folderName, match, pattern)) {
        info.date = match[1].str();
        info.session = match[2].str();
        std::transform(info.session.begin(), info.session.end(), info.session.begin(), ::towupper);
        info.sessionType = (info.session.find(L'M') != std::wstring::npos) ? L"Morning" : L"Evening";

        std::wstring remainder;
        if (match[5].matched) {
            // Merged e.g. "01AQ-"
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

        // Try to find known event codes in remainder or item folder
        // Remainder could be: "01N-30338708", "N-", "01AQ-30338708", "01-Z-", etc.
        std::wstring upRemainder = remainder;
        std::transform(upRemainder.begin(), upRemainder.end(), upRemainder.begin(), ::towupper);

        // Sort official events by code length descending so "QMZ" matches before "Q" or "M"
        auto events = GetOfficialEvents();
        std::sort(events.begin(), events.end(), [](const EventDefinition& a, const EventDefinition& b) {
            return wcslen(a.code) > wcslen(b.code);
        });

        // 1. Look for occurrence + code (e.g. "01AQ" or "02N")
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

        // 2. Direct code search if not found
        if (info.eventCode.empty()) {
            for (const auto& ev : events) {
                // Check if code is surrounded by '-' or at boundary
                std::wstring c = ev.code;
                size_t pos = upRemainder.find(c);
                if (pos != std::wstring::npos) {
                    info.eventCode = ev.code;
                    info.eventName = ev.name;
                    break;
                }
            }
        }

        // 3. Extract 8-digit ITS number if present
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

// Determines folder level
inline FolderLevel DetectFolderLevel(const std::wstring& folderName) {
    // 1. Check Date Session: "1448-03-13 _01M" or "1448-04-05 _02E"
    static const std::wregex dateSessionPattern(LR"(^\d{4}-\d{2}-\d{2}\s*_\d{2}[MEme].*$)");
    if (std::regex_match(folderName, dateSessionPattern)) {
        // If it also contains item index like "-01-", it's an Item folder
        if (folderName.find(L"-01-") != std::wstring::npos || 
            folderName.find(L"-02-") != std::wstring::npos ||
            folderName.find(L"-03-") != std::wstring::npos ||
            ParseItemFolderName(folderName).isValid) {
            return FolderLevel::ItemEvent;
        }
        return FolderLevel::DateSession;
    }

    // 2. Check Safar Root: starts with Hijri Year e.g. "1448-" or "1447-"
    static const std::wregex safarRootPattern(LR"(^14\d{2}[-_]\d{1,2}.*$)");
    if (std::regex_match(folderName, safarRootPattern)) {
        return FolderLevel::SafarRoot;
    }

    return FolderLevel::Unknown;
}
