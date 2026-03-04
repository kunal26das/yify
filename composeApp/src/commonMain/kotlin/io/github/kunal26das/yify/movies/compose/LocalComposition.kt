package io.github.kunal26das.yify.movies.compose

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.unit.dp
import io.github.kunal26das.yify.movies.domain.model.Movie

private const val DEFAULT_ERROR_MESSAGE = "No active local composition found!"
private const val DEFAULT_DP = 16

val LocalCornerRadius = compositionLocalOf { DEFAULT_DP.dp / 1.5f }
val LocalSelectedMovie = compositionLocalOf { mutableStateOf<Movie?>(null) }
val LocalShimmer = compositionLocalOf<Shimmer> { error(DEFAULT_ERROR_MESSAGE) }
