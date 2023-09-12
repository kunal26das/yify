package io.github.kunal26das.yify

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import java.lang.Integer.min

object Constants {

    const val LOAD_SIZE = 10
    const val FIRST_PAGE = 1
    private const val RATIO = 1.65f
    private const val MOVIE_WIDTH = 320

    val movieWidth: Dp
        @Composable get() {
            val config = LocalConfiguration.current
            return min(config.screenWidthDp / 3, MOVIE_WIDTH).dp
        }

    val movieHeight: Dp
        @Composable get() = movieWidth * RATIO
}