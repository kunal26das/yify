package io.github.kunal26das.yify.movies.compose

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import coil3.compose.AsyncImagePainter
import coil3.compose.LocalPlatformContext
import coil3.request.ImageRequest

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
        model = ImageRequest.Builder(LocalPlatformContext.current).apply {
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