package io.github.kunal26das.common.compose

import androidx.compose.runtime.compositionLocalOf

val LocalShimmer = compositionLocalOf<Shimmer> {
    error("No active shimmer found!")
}

val LocalShimmerAnimation = compositionLocalOf<ShimmerAnimation> {
    error("No active shimmer animation found!")
}