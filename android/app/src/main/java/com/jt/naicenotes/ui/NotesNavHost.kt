package com.jt.naicenotes.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.jt.naicenotes.ui.home.HomeScreen
import com.jt.naicenotes.ui.scan.ScanRecipeScreen

/** Result key: the section a recipe scan just filled, so Home can switch to it. */
private const val SCANNED_SECTION_KEY = "scannedSectionId"

private object Routes {
    const val HOME = "home"
    const val SCAN = "scan?sectionId={sectionId}"
    fun scan(sectionId: Long?): String =
        "scan?sectionId=${sectionId ?: -1L}"
}

@Composable
fun NotesNavHost(initialSectionId: Long? = null) {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = Routes.HOME) {
        composable(Routes.HOME) { entry ->
            val scannedSectionId by entry.savedStateHandle
                .getStateFlow<Long?>(SCANNED_SECTION_KEY, null)
                .collectAsStateWithLifecycle()
            HomeScreen(
                initialSectionId = initialSectionId,
                jumpToSectionId = scannedSectionId,
                onJumped = { entry.savedStateHandle[SCANNED_SECTION_KEY] = null },
                onScan = { sectionId ->
                    navController.navigate(Routes.scan(sectionId))
                },
            )
        }
        composable(
            route = Routes.SCAN,
            arguments = listOf(
                navArgument("sectionId") {
                    type = NavType.LongType
                    defaultValue = -1L
                },
            ),
        ) { entry ->
            val raw = entry.arguments?.getLong("sectionId") ?: -1L
            val sectionId = raw.takeIf { it >= 0 }
            ScanRecipeScreen(
                initialSectionId = sectionId,
                onClose = { navController.popBackStack() },
                onAdded = { target ->
                    navController.previousBackStackEntry?.savedStateHandle?.set(SCANNED_SECTION_KEY, target)
                    navController.popBackStack()
                },
            )
        }
    }
}
