package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import io.github.kunal26das.yify.movies.domain.model.Movie
import io.github.kunal26das.yify.movies.presentation.Destination

@Composable
fun MovieCard(
    modifier: Modifier = Modifier,
    movie: Movie? = null,
) {
    val navHostController = LocalNavHostController.current
    YifySubcomposeAsyncImage(
        modifier = modifier
            .clip(RoundedCornerShape(LocalCornerRadius.current / 1.5f))
            .clickable {
                if (movie != null) {
                    navHostController?.navigate(Destination.MovieDetails(movie))
                }
            },
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