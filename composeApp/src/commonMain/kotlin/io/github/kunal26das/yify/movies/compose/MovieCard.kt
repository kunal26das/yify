package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.kunal26das.yify.movies.domain.model.Movie

@Composable
fun MovieCard(
    modifier: Modifier = Modifier,
    movie: Movie? = null,
) {
    val selectedMovie = LocalSelectedMovie.current
    Surface(
        modifier = modifier
            .clickable {
                selectedMovie.value = movie
//                if (movie != null) {
//                    navHostController?.navigate(Destination.MovieDetails(movie))
//                }
            },
        shape = RoundedCornerShape(LocalCornerRadius.current / 1.5f),
        shadowElevation = 8.dp
    ) {
        YifySubcomposeAsyncImage(
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
}