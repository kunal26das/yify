package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import coil.request.ImageRequest
import io.github.kunal26das.common.compose.shimmer
import io.github.kunal26das.yify.movies.domain.model.Movie

val AsyncImagePainter.State.isLoading
    get() = this is AsyncImagePainter.State.Loading
            || this is AsyncImagePainter.State.Empty

val AsyncImagePainter.State.isError
    get() = this is AsyncImagePainter.State.Error

@Composable
fun MovieCard(
    modifier: Modifier = Modifier,
    movie: Movie? = null,
    onClick: (Movie?) -> Unit = {},
) {
    val interactionSource = remember { MutableInteractionSource() }
    ElevatedCard(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        onClick = { onClick.invoke(movie) },
        interactionSource = interactionSource,
    ) {
        Movie(
            modifier = Modifier.fillMaxSize(),
            movie = movie,
        )
    }
}

@Composable
fun Movie(
    modifier: Modifier = Modifier,
    movie: Movie?,
) {
    var state by remember { mutableStateOf<AsyncImagePainter.State>(AsyncImagePainter.State.Empty) }
    Box(
        modifier = modifier.shimmer(
            label = movie?.slug ?: "shimmer",
            enabled = state.isLoading,
        )
    ) {
        if (movie == null || state.isError) {
            Text(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(8.dp),
                text = movie?.title.orEmpty(),
                textAlign = TextAlign.Center,
            )
        }
        if (movie != null) {
            AsyncImage(
                modifier = Modifier.fillMaxSize(),
                model = ImageRequest.Builder(LocalContext.current).apply {
                    data(movie.coverImageUrl)
                    memoryCacheKey(movie.slug)
                    diskCacheKey(movie.slug)
                }.build(),
                contentDescription = movie.slug,
                contentScale = ContentScale.Crop,
                onState = { state = it },
            )
        }
    }
}