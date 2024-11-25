package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import io.github.kunal26das.yify.movies.Constants
import io.github.kunal26das.yify.movies.domain.model.Movie

@Composable
fun TrailerCard(
    modifier: Modifier = Modifier,
    movie: Movie,
    shadowElevation: Dp = Dp.Unspecified,
    shape: Shape = RoundedCornerShape(0.dp),
) {
    if (movie.youtubeTrailerCode.isNotEmpty()) {
        Surface(
            modifier = modifier
                .aspectRatio(Constants.TRAILER_ASPECT_RATIO)
                .fillMaxSize(),
            shadowElevation = shadowElevation,
            shape = shape,
        ) {
            YoutubePlayer(
                modifier = Modifier.fillMaxSize(),
                videoId = movie.youtubeTrailerCode,
            )
        }
    }
}