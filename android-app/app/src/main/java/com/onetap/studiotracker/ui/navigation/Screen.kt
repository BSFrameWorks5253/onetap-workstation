package com.onetap.studiotracker.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.DesktopWindows
import androidx.compose.material.icons.filled.MovieCreation
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ViewKanban
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    data object Dashboard : Screen("dashboard", "Dashboard", Icons.Default.Dashboard)
    data object Kanban : Screen("kanban", "Pipeline", Icons.Default.ViewKanban)
    data object PhotoTracker : Screen("photos", "Photos", Icons.Default.PhotoLibrary)
    data object Render : Screen("render", "Render", Icons.Default.MovieCreation)
    data object Editors : Screen("editors", "Editors", Icons.Default.People)
    data object Analytics : Screen("analytics", "Stats", Icons.Default.BarChart)
    data object Remote : Screen("remote", "Laptop", Icons.Default.DesktopWindows)
    data object Settings : Screen("settings", "Settings", Icons.Default.Settings)

    companion object {
        val items: List<Screen>
            get() = listOf(Dashboard, Kanban, PhotoTracker, Render, Analytics)
    }
}
