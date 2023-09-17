package io.github.kunal26das.yify

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import java.lang.Integer.min

object Constants {

    const val LOAD_SIZE = 10
    const val FIRST_PAGE = 1
    const val MAX_LOAD_SIZE = 50

    private const val MOVIE_WIDTH = 320
    const val MOVIE_ASPECT_RATIO = 2 / 3f
    const val TRAILER_ASPECT_RATIO = 16 / 9f

    val movieWidth: Dp
        @Composable get() {
            val config = LocalConfiguration.current
            return min(config.screenWidthDp / 3, MOVIE_WIDTH).dp
        }
}