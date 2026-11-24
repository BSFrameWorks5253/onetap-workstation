package com.onetap.studiotracker.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.ViewKanban
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    data object Dashboard : Screen("dashboard", "Dashboard", Icons.Default.Dashboard)
    data object Kanban : Screen("kanban", "Pipeline", Icons.Default.ViewKanban)
    data object PhotoTracker : Screen("photos", "Photos", Icons.Default.PhotoLibrary)

    companion object {
        val items = listOf(Dashboard, Kanban, PhotoTracker)
    }
}
