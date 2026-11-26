package com.onetap.studiotracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import com.onetap.studiotracker.ui.OneTapApp
import com.onetap.studiotracker.ui.theme.OneTapStudioTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try { WindowCompat.setDecorFitsSystemWindows(window, false) } catch (_: Throwable) {}
        setContent {
            OneTapStudioTheme {
                OneTapApp()
            }
        }
    }
}
