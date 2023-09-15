package io.github.kunal26das.yify.compose

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.core.graphics.drawable.toBitmap
import androidx.palette.graphics.Palette
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import coil.request.ImageRequest
import io.github.kunal26das.yify.domain.model.Movie

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MovieCard(
    modifier: Modifier = Modifier,
    movie: Movie? = null,
    onClick: (Movie?) -> Unit = {},
) {
    val interactionSource = remember { MutableInteractionSource() }
    var palette by remember { mutableStateOf<Palette?>(null) }
    var state by remember { mutableStateOf<AsyncImagePainter.State>(AsyncImagePainter.State.Empty) }
    ElevatedCard(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        onClick = { onClick.invoke(movie) },
        interactionSource = interactionSource,
    ) {
        Box {
            CoverImage(movie) {
                state = it
            }
            when (state) {
                is AsyncImagePainter.State.Error -> {
                    Text(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(8.dp),
                        text = movie?.title.orEmpty(),
                        textAlign = TextAlign.Center,
                    )
                }

                is AsyncImagePainter.State.Loading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                    )
                }

                is AsyncImagePainter.State.Success -> {
                    val result = (state as AsyncImagePainter.State.Success).result
                    palette = Palette.from(result.drawable.toBitmap()).generate()
                }

                else -> Unit
            }
        }
    }
}

@Composable
private fun CoverImage(
    movie: Movie?,
    onStateChange: (AsyncImagePainter.State) -> Unit = {}
) {
    AsyncImage(
        modifier = Modifier.fillMaxSize(),
        model = ImageRequest.Builder(LocalContext.current).apply {
            placeholderMemoryCacheKey(movie?.slug)
            memoryCacheKey(movie?.slug)
            data(movie?.coverImageUrl)
            diskCacheKey(movie?.slug)
        }.build(),
        contentDescription = movie?.slug,
        contentScale = ContentScale.Crop,
        onState = onStateChange,
    )
}