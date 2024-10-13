package io.github.kunal26das.yify.movies.compose

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController

val LocalShimmer = compositionLocalOf<Shimmer> {
    error("No active shimmer found!")
}

val LocalShimmerAnimation = compositionLocalOf<ShimmerAnimation> {
    error("No active shimmer animation found!")
}

val LocalNavHostController = compositionLocalOf<NavHostController?> {
    error("No active nav host controller found!")
}

val LocalCornerRadius = compositionLocalOf<Dp> { 8.dp }

val LocalStatusBarHeight = compositionLocalOf<Dp> { 8.dp }

val LocalNavigationBarHeight = compositionLocalOf<Dp> { 8.dp }
