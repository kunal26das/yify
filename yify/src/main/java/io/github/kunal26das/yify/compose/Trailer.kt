package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ElevatedCard
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.domain.model.Movie

@Composable
fun TrailerCard(
    modifier: Modifier = Modifier,
    movie: Movie?,
    shape: Shape = RoundedCornerShape(0.dp),
) {
    if (movie?.youtubeTrailerCode.isNullOrEmpty().not()) {
        ElevatedCard(
            modifier = modifier
                .aspectRatio(Constants.TRAILER_ASPECT_RATIO)
                .fillMaxSize(),
            shape = shape,
        ) {
            YoutubePlayer(
                modifier = Modifier.fillMaxSize(),
                videoId = movie?.youtubeTrailerCode.orEmpty(),
            )
        }
    }
}