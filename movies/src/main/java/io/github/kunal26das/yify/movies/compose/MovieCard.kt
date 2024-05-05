package io.github.kunal26das.yify.movies.compose

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import io.github.kunal26das.common.compose.YifyAsyncImage
import io.github.kunal26das.common.compose.YifySubcomposeAsyncImage
import io.github.kunal26das.yify.movies.domain.model.Movie
import io.github.kunal26das.yify.movies.presentation.MovieActivity

@Composable
fun MovieCard(
    modifier: Modifier = Modifier,
    movie: Movie? = null,
) {
    val movieActivity = rememberLauncherForActivityResult(MovieActivity.Contract()) {}
    val modifier2 = modifier
        .clip(RoundedCornerShape(8.dp))
        .clickable {
            if (movie != null) {
                movieActivity.launch(movie)
            }
        }
    YifySubcomposeAsyncImage(
        modifier = modifier2,
        builder = {
            data(movie?.smallCoverImageUrl)
            diskCacheKey(movie?.smallCoverImageUrl)
            memoryCacheKey(movie?.smallCoverImageUrl)
        },
        content = {
            YifyAsyncImage(
                modifier = Modifier.fillMaxSize(),
                enableShimmer = false,
                builder = {
                    data(movie?.mediumCoverImageUrl)
                    diskCacheKey(movie?.mediumCoverImageUrl)
                    memoryCacheKey(movie?.mediumCoverImageUrl)
                },
            )
        }
    )
}