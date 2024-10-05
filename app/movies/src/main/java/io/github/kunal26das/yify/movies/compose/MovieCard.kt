package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.window.Dialog
import io.github.kunal26das.common.compose.LocalCornerRadius
import io.github.kunal26das.common.compose.YifyAsyncImage
import io.github.kunal26das.common.compose.YifySubcomposeAsyncImage
import io.github.kunal26das.yify.movies.domain.model.Movie

@Composable
fun MovieCard(
    modifier: Modifier = Modifier,
    movie: Movie? = null,
) {
    var isDialogVisible by remember { mutableStateOf(false) }
    val modifier2 = modifier
        .clip(RoundedCornerShape(LocalCornerRadius.current / 1.5f))
        .clickable {
            if (movie != null) {
                isDialogVisible = true
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
    if (isDialogVisible && movie != null) {
        Dialog(
            onDismissRequest = {
                isDialogVisible = false
            },
            content = {
                MovieDialog(
                    modifier = Modifier
                        .fillMaxHeight(0.75f)
                        .clip(RoundedCornerShape(LocalCornerRadius.current / 1.5f))
                        .background(MaterialTheme.colorScheme.background),
                    movie = movie,
                )
            }
        )
    }
}