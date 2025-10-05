package io.github.kunal26das.yify.movies

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

object Constants {

    const val LOAD_SIZE = 50
    const val FIRST_PAGE = 1

    private const val MOVIE_WIDTH = 256
    const val MOVIE_ASPECT_RATIO = 2 / 3f
    const val TRAILER_ASPECT_RATIO = 16 / 9f

    val movieWidth: Dp
        @Composable get() {
            val config = LocalWindowInfo.current
            return (config.containerSize.width / 2).dp
        }
}