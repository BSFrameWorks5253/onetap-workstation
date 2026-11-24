package com.onetap.studiotracker.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.components.AppUpdateDialog
import com.onetap.studiotracker.ui.components.BottomNavBar
import com.onetap.studiotracker.ui.navigation.Screen
import com.onetap.studiotracker.ui.screens.analytics.StudioAnalyticsScreen
import com.onetap.studiotracker.ui.screens.dashboard.DashboardScreen
import com.onetap.studiotracker.ui.screens.kanban.KanbanScreen
import com.onetap.studiotracker.ui.screens.photos.PhotoTrackerScreen
import com.onetap.studiotracker.ui.screens.radar.IngestRadarScreen
import com.onetap.studiotracker.ui.theme.DarkBackground
import com.onetap.studiotracker.util.AppUpdateInfo
import com.onetap.studiotracker.util.BatchNotificationManager
import com.onetap.studiotracker.util.UpdateManager

@Composable
fun OneTapApp() {
    val context = LocalContext.current
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Dashboard.route

    val repository = SafarRepository.getInstance()
    val campaigns by repository.campaigns.collectAsState()
    val ongoingTasks = campaigns.firstOrNull { it.isOngoing }?.tasks ?: emptyList()
    val pendingCount = ongoingTasks.count { it.stage != Stage.UPLOADED && it.stage != Stage.ALJAMEA_DONE }

    // Auto-update checker state
    var pendingUpdate by remember { mutableStateOf<AppUpdateInfo?>(null) }

    LaunchedEffect(Unit) {
        // Initialize notification channel for lifetime-free render alerts
        BatchNotificationManager.createNotificationChannel(context)

        val result = UpdateManager.checkForUpdates()
        if (result.isSuccess) {
            val info = result.getOrNull()
            if (info != null && info.isUpdateAvailable) {
                pendingUpdate = info
            }
        }
    }

    Scaffold(
        containerColor = DarkBackground,
        bottomBar = {
            BottomNavBar(
                currentRoute = currentRoute,
                onNavigate = { screen ->
                    if (currentRoute != screen.route) {
                        navController.navigate(screen.route) {
                            popUpTo(navController.graph.startDestinationId) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                pendingTaskCount = pendingCount
            )
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Dashboard.route,
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = innerPadding.calculateBottomPadding())
        ) {
            composable(Screen.Dashboard.route) {
                DashboardScreen(
                    onNavigateKanban = {
                        navController.navigate(Screen.Kanban.route) {
                            launchSingleTop = true
                        }
                    }
                )
            }
            composable(Screen.Kanban.route) {
                KanbanScreen()
            }
            composable(Screen.PhotoTracker.route) {
                PhotoTrackerScreen()
            }
            composable(Screen.Radar.route) {
                IngestRadarScreen()
            }
            composable(Screen.Analytics.route) {
                StudioAnalyticsScreen()
            }
        }
    }

    // Auto-update dialog presentation
    pendingUpdate?.let { updateInfo ->
        AppUpdateDialog(
            updateInfo = updateInfo,
            onDismiss = { pendingUpdate = null }
        )
    }
}
