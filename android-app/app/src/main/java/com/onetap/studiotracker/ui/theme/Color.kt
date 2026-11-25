package com.onetap.studiotracker.ui.theme

import androidx.compose.ui.graphics.Color

// Pristine Light Mode Only Design Tokens (matched to safar-tracker-web)
val LightBackground = Color(0xFFF8FAFC)      // --surface-2 / --color-paper
val LightSurface = Color(0xFFFFFFFF)         // --surface / --color-plate
val LightSurfaceSubtle = Color(0xFFF1F5F9)   // --surface-3 / --color-paper-3
val LightBorder = Color(0xFFE2E8F0)          // --border / --color-rule
val LightBorderStrong = Color(0xFFCBD5E1)    // --color-rule-2

val IndigoPrimary = Color(0xFF4F46E5)        // Indigo 600
val IndigoAccent = Color(0xFF6366F1)         // Indigo 500
val IndigoSoft = Color(0xFFEEF2FF)           // Indigo 50

val EmeraldSuccess = Color(0xFF10B981)       // Emerald 500
val EmeraldDark = Color(0xFF059669)          // Emerald 600
val EmeraldSoft = Color(0xFFECFDF5)          // Emerald 50
val EmeraldGlow = Color(0xFF059669)          // Accessible emerald on light surface

val AmberWarning = Color(0xFFF59E0B)         // Amber 500
val AmberDark = Color(0xFFD97706)            // Amber 600
val AmberSoft = Color(0xFFFFFBEB)            // Amber 50

val BlueInfo = Color(0xFF3B82F6)             // Blue 500
val BlueDark = Color(0xFF2563EB)             // Blue 600
val BlueSoft = Color(0xFFEFF6FF)             // Blue 50

val CyanInfo = Color(0xFF06B6D4)             // Cyan 500
val CyanDark = Color(0xFF0891B2)             // Cyan 600
val CyanSoft = Color(0xFFECFEFF)             // Cyan 50

val VioletAccent = Color(0xFF8B5CF6)         // Violet 500
val VioletSoft = Color(0xFFF5F3FF)           // Violet 50

val RoseError = Color(0xFFEF4444)            // Rose/Red 500
val RoseDark = Color(0xFFDC2626)             // Red 600
val RoseSoft = Color(0xFFFEF2F2)             // Red 50

val TextPrimary = Color(0xFF0F172A)          // Slate 900 (--text-primary)
val TextSecondary = Color(0xFF64748B)        // Slate 500 (--text-secondary)
val TextMuted = Color(0xFF94A3B8)            // Slate 400 (--text-muted)

// Stage-specific distinct colors
val ColorEditingPending = Color(0xFFF59E0B)
val ColorInProgress = Color(0xFF3B82F6)
val ColorUploadPending = Color(0xFF06B6D4)
val ColorUploaded = Color(0xFF10B981)
val ColorAlJameaDone = Color(0xFF059669)

// Light-mode compatibility aliases for legacy references
val DarkBackground = LightBackground
val DarkSurface = LightSurface
val DarkSurfaceCard = LightSurface
val DarkSurfaceElevated = LightSurfaceSubtle
val DarkBorder = LightBorder
