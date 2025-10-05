package io.github.kunal26das.yify.movies.compose

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.unit.dp
import io.github.kunal26das.yify.movies.domain.model.Movie

private const val DEFAULT_ERROR_MESSAGE = "No active local composition found!"
private const val DEFAULT_DP = 8

val LocalCornerRadius = compositionLocalOf { DEFAULT_DP.dp }
val LocalStatusBarHeight = compositionLocalOf { DEFAULT_DP.dp }
val LocalNavigationBarHeight = compositionLocalOf { DEFAULT_DP.dp }
val LocalShimmer = compositionLocalOf<Shimmer> { error(DEFAULT_ERROR_MESSAGE) }
val LocalSelectedMovie = compositionLocalOf { mutableStateOf<Movie?>(null) }
