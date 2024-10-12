package io.github.kunal26das.yify.movies.compose

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers

@Composable
fun YifyAsyncImage(
    modifier: Modifier = Modifier,
    key: Any? = null,
    enableShimmer: Boolean = true,
    contentDescription: String? = null,
    contentScale: ContentScale = ContentScale.Crop,
    onState: (AsyncImagePainter.State) -> Unit = {},
    builder: ImageRequest.Builder.() -> Unit = {},
) {
    var state by remember(key) {
        mutableStateOf<AsyncImagePainter.State>(
            AsyncImagePainter.State.Empty
        )
    }
    AsyncImage(
        modifier = modifier.yifyShimmer(enableShimmer and state.isLoading),
        model = ImageRequest.Builder(LocalContext.current).apply {
            dispatcher(Dispatchers.IO)
            crossfade(true)
            builder.invoke(this)
        }.build(),
        contentDescription = contentDescription,
        contentScale = contentScale,
        onState = {
            state = it
            onState.invoke(it)
        }
    )
}