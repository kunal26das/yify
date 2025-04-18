package io.github.kunal26das.yify.movies.compose

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import io.github.kunal26das.yify.movies.domain.model.Movie

@Composable
fun Theme(
    activity: Activity,
    navHostController: NavHostController? = null,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    CompositionLocalProvider(
        LocalActivity provides activity,
        LocalShimmer provides Shimmer.shimmer(),
        LocalCornerRadius provides cornerRadius,
        LocalStatusBarHeight provides statusBarHeight,
        LocalNavHostController provides navHostController,
        LocalNavigationBarHeight provides navigationBarHeight,
    ) {
        MaterialTheme(
            colorScheme = when {
                isSystemInDarkTheme() -> dynamicDarkColorScheme(context)
                else -> dynamicLightColorScheme(context)
            },
            content = content,
        )
    }
}