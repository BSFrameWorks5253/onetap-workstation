package com.onetap.studiotracker.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.ui.components.BottomNavBar
import com.onetap.studiotracker.ui.navigation.Screen
import com.onetap.studiotracker.ui.screens.dashboard.DashboardScreen
import com.onetap.studiotracker.ui.screens.kanban.KanbanScreen
import com.onetap.studiotracker.ui.screens.photos.PhotoTrackerScreen
import com.onetap.studiotracker.ui.theme.DarkBackground

@Composable
fun OneTapApp() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Dashboard.route

    val repository = SafarRepository.getInstance()
    val campaigns by repository.campaigns.collectAsState()
    val ongoingTasks = campaigns.firstOrNull { it.isOngoing }?.tasks ?: emptyList()
    val pendingCount = ongoingTasks.count { it.stage != Stage.UPLOADED && it.stage != Stage.ALJAMEA_DONE }

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
        }
    }
}
