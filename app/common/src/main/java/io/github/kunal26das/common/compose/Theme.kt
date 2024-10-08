package io.github.kunal26das.common.compose

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController

@Composable
fun Theme(
    navHostController: NavHostController? = null,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val shimmer = Shimmer.shimmer()
    val animation = shimmer.animation()
    CompositionLocalProvider(
        LocalShimmer provides shimmer,
        LocalCornerRadius provides cornerRadius,
        LocalShimmerAnimation provides animation,
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