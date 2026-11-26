package com.onetap.studiotracker.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightOnlyColorScheme = lightColorScheme(
    primary = IndigoPrimary,
    onPrimary = Color.White,
    primaryContainer = IndigoSoft,
    onPrimaryContainer = IndigoPrimary,
    secondary = EmeraldSuccess,
    onSecondary = Color.White,
    secondaryContainer = EmeraldSoft,
    onSecondaryContainer = EmeraldDark,
    tertiary = CyanInfo,
    onTertiary = Color.White,
    background = LightBackground,
    onBackground = TextPrimary,
    surface = LightSurface,
    onSurface = TextPrimary,
    surfaceVariant = LightSurfaceSubtle,
    onSurfaceVariant = TextSecondary,
    outline = LightBorder,
    outlineVariant = LightBorderStrong,
    error = RoseError,
    onError = Color.White
)

@Composable
fun OneTapStudioTheme(content: @Composable () -> Unit) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            window?.statusBarColor = LightBackground.toArgb()
            window?.navigationBarColor = LightSurface.toArgb()
            if (window != null) {
                val controller = WindowCompat.getInsetsController(window, view)
                controller.isAppearanceLightStatusBars = true
                controller.isAppearanceLightNavigationBars = true
            }
        }
    }
    MaterialTheme(
        colorScheme = LightOnlyColorScheme,
        typography = Typography(),
        content = content
    )
}
