package io.github.kunal26das.yify.movies.compose

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.navigation.NavHostController

@Composable
fun CompositionLocalProvider(
    navHostController: NavHostController? = null,
    content: @Composable () -> Unit,
) {
    val shimmer = Shimmer.shimmer()
    val animation = shimmer.animation()
    CompositionLocalProvider(
        LocalShimmer provides shimmer,
        LocalCornerRadius provides cornerRadius,
        LocalShimmerAnimation provides animation,
        LocalStatusBarHeight provides statusBarHeight,
        LocalNavHostController provides navHostController,
        LocalNavigationBarHeight provides navigationBarHeight,
        content = content,
    )
}