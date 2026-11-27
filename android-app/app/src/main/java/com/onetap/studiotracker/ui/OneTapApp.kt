package com.onetap.studiotracker.ui

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.components.AppUpdateDialog
import com.onetap.studiotracker.ui.components.BottomNavBar
import com.onetap.studiotracker.ui.components.NewSafarReceivedDateDialog
import com.onetap.studiotracker.ui.components.StartupScreen
import com.onetap.studiotracker.ui.navigation.Screen
import com.onetap.studiotracker.ui.screens.analytics.StudioAnalyticsScreen
import com.onetap.studiotracker.ui.screens.dashboard.DashboardScreen
import com.onetap.studiotracker.ui.screens.editors.EditorsScreen
import com.onetap.studiotracker.ui.screens.kanban.KanbanScreen
import com.onetap.studiotracker.ui.screens.photos.PhotoTrackerScreen
import com.onetap.studiotracker.ui.screens.remote.LaptopRemoteScreen
import com.onetap.studiotracker.ui.screens.render.RenderBatchScreen
import com.onetap.studiotracker.ui.screens.settings.SettingsScreen
import com.onetap.studiotracker.ui.theme.LiquidAuroraBackground
import com.onetap.studiotracker.util.AppUpdateInfo
import com.onetap.studiotracker.util.BatchNotificationManager
import com.onetap.studiotracker.util.UpdateManager
import kotlinx.coroutines.delay

@Composable
fun OneTapApp() {
    val context = LocalContext.current
    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route ?: Screen.Dashboard.route

    val repository = SafarRepository.getInstance()
    val campaigns by repository.campaigns.collectAsState()
    val syncState by repository.syncState.collectAsState()
    val isInitialLoading by repository.isInitialLoading.collectAsState()

    val ongoingTasks = campaigns.firstOrNull { it.isOngoing }?.tasks ?: emptyList()
    val pendingCount = ongoingTasks.count { it.stage != Stage.UPLOADED && it.stage != Stage.ALJAMEA_DONE }
    val pendingNewSafar by repository.pendingNewSafarPrompt.collectAsState()

    var pendingUpdate by remember { mutableStateOf<AppUpdateInfo?>(null) }
    var minSplashElapsed by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        BatchNotificationManager.createNotificationChannel(context)
        delay(1600)
        minSplashElapsed = true
    }

    LaunchedEffect(Unit) {
        try {
            val res = UpdateManager.checkForUpdates(context)
            res.getOrNull()?.takeIf { it.isUpdateAvailable }?.let { pendingUpdate = it }
        } catch (_: Throwable) {}
    }

    val showStartup = !minSplashElapsed || (isInitialLoading && campaigns.isEmpty())

    Crossfade(targetState = showStartup, animationSpec = tween(350), label = "startupCrossfade") { splash ->
        if (splash) {
            StartupScreen(
                statusText = syncState.syncNotice,
                isRealtimeConnected = syncState.isRealtimeConnected
            )
        } else {
            LiquidAuroraBackground(route = currentRoute) {
                Scaffold(
                    containerColor = Color.Transparent,
                    bottomBar = {
                        if (currentRoute != Screen.Settings.route && currentRoute != Screen.Remote.route) {
                            BottomNavBar(
                                currentRoute = currentRoute,
                                onNavigate = { screen ->
                                    if (currentRoute != screen.route) {
                                        navController.navigate(screen.route) {
                                            popUpTo(navController.graph.startDestinationId) { saveState = true }
                                            launchSingleTop = true
                                            restoreState = true
                                        }
                                    }
                                },
                                pendingTaskCount = pendingCount
                            )
                        }
                    }
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = Screen.Dashboard.route,
                        modifier = Modifier.fillMaxSize().padding(bottom = innerPadding.calculateBottomPadding())
                    ) {
                        composable(Screen.Dashboard.route) {
                            DashboardScreen(
                                onNavigateKanban = { navController.navigate(Screen.Kanban.route) { launchSingleTop = true } },
                                onNavigateSettings = { navController.navigate(Screen.Settings.route) { launchSingleTop = true } }
                            )
                        }
                        composable(Screen.Kanban.route) { KanbanScreen() }
                        composable(Screen.PhotoTracker.route) { PhotoTrackerScreen() }
                        composable(Screen.Render.route) {
                            RenderBatchScreen(
                                onOpenLaptopRemote = { navController.navigate(Screen.Remote.route) { launchSingleTop = true } }
                            )
                        }
                        composable(Screen.Editors.route) { EditorsScreen() }
                        composable(Screen.Analytics.route) { StudioAnalyticsScreen() }
                        composable(Screen.Remote.route) { LaptopRemoteScreen(onBack = { navController.popBackStack() }) }
                        composable(Screen.Settings.route) { SettingsScreen(onBack = { navController.popBackStack() }) }
                    }
                }
            }
        }
    }

    pendingUpdate?.let { AppUpdateDialog(updateInfo = it, onDismiss = { pendingUpdate = null }) }
    pendingNewSafar?.let { safarName ->
        NewSafarReceivedDateDialog(
            safarName = safarName,
            onSave = { dateStr -> repository.setSafarReceivedDate(safarName, dateStr) },
            onDismiss = { repository.dismissNewSafarPrompt(safarName) }
        )
    }
}
