package io.github.kunal26das.common.compose

import android.app.Activity
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

val LocalStatusBarHeight = compositionLocalOf<Dp> { 8.dp }

val LocalNavigationBarHeight = compositionLocalOf<Dp> { 8.dp }

val LocalCornerRadius = compositionLocalOf<Dp> { 8.dp }

val LocalNavHostController = compositionLocalOf<NavHostController?> {
    error("No active nav host controller found!")
}

val LocalActivity = compositionLocalOf<Activity> {
    error("No active activity found!")
}